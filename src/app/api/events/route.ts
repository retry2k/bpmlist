import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { kv } from "@vercel/kv";
import { EventData } from "@/types/event";
import { REGIONS } from "@/types/event";
import { CITY_COORDS } from "@/lib/city-coords";
import { VENUE_COORDS } from "@/lib/venue-coords";

// In-memory venue geocode cache (fast layer, survives within same instance)
const VENUE_GEOCODE_CACHE = new Map<string, { lat: number; lng: number; address: string } | null>();

// Cache for RA venue coordinates
const RA_VENUE_CACHE = new Map<string, { lat: number; lng: number; address: string } | null>();

// KV venue cache helpers — persistent across deploys & cold starts
type VenueCoord = { lat: number; lng: number; address: string };

async function kvGetVenue(key: string): Promise<VenueCoord | null> {
  try {
    const result = await kv.get<VenueCoord>(`venue:${key}`);
    return result || null;
  } catch {
    return null;
  }
}

async function kvSetVenue(key: string, coords: VenueCoord): Promise<void> {
  try {
    // Store permanently in KV (no expiry)
    await kv.set(`venue:${key}`, coords);
  } catch {
    // Silently fail — KV is best-effort enhancement
  }
}

// Rate limit tracking for Nominatim
let lastGeocode = 0;

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastGeocode));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "bpmlist/1.0 (event map)" },
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (data && data.length > 0) {
      const item = data[0];
      const parts = (item.display_name || "").split(",").map((s: string) => s.trim());
      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address: parts.slice(0, 3).join(", "),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

// Scrape address from event page (Eventbrite, RA, etc.)
async function scrapeAddressFromUrl(eventUrl: string): Promise<string | null> {
  if (!eventUrl) return null;
  try {
    const res = await fetch(eventUrl, {
      headers: { "User-Agent": "bpmlist/1.0 (event map)" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const addressPatterns = [
      /at\s+(\d+[^,]+,\s*[A-Za-z\s]+,\s*[A-Z]{2})/i,
      /"address":\s*"([^"]+)"/i,
      /"streetAddress":\s*"([^"]+)"/i,
      /location[^"]*"[^"]*(\d+\s+[A-Za-z\s]+(?:St|Ave|Blvd|Rd|Dr|Way|Pl|Ct|Ln|Pkwy|Hwy)[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2})/i,
    ];
    for (const pattern of addressPatterns) {
      const match = html.match(pattern);
      if (match) return match[1].trim();
    }
  } catch {
    // ignore
  }
  return null;
}

// Quick geocode: just venue + city + state (used on hot path)
async function geocodeVenueQuick(
  venueName: string,
  city: string,
  state: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = `${venueName}|${city}`;
  if (VENUE_GEOCODE_CACHE.has(key)) return VENUE_GEOCODE_CACHE.get(key)!;

  // Check persistent KV cache before hitting geocoding APIs
  const kvResult = await kvGetVenue(key);
  if (kvResult) {
    VENUE_GEOCODE_CACHE.set(key, kvResult);
    return kvResult;
  }

  const result = await nominatimSearch(`${venueName}, ${city}, ${state}`);
  if (result) {
    VENUE_GEOCODE_CACHE.set(key, result);
    kvSetVenue(key, result); // persist to KV (fire-and-forget)
    return result;
  }
  VENUE_GEOCODE_CACHE.set(key, null);
  return null;
}

// Deep geocode: scrape event page + try without city (used in background)
async function geocodeVenueDeep(
  venueName: string,
  city: string,
  state: string,
  eventUrl: string,
): Promise<void> {
  const key = `${venueName}|${city}`;
  // Skip if already geocoded successfully
  if (VENUE_GEOCODE_CACHE.get(key)) return;

  try {
    // Strategy 1: Scrape address from event page
    const scrapedAddress = await scrapeAddressFromUrl(eventUrl);
    if (scrapedAddress) {
      const result = await nominatimSearch(scrapedAddress);
      if (result) {
        VENUE_GEOCODE_CACHE.set(key, result);
        kvSetVenue(key, result); // persist to KV
        return;
      }
    }

    // Strategy 2: Try venue + state only (city might be wrong)
    const result = await nominatimSearch(`${venueName}, ${state}`);
    if (result) {
      VENUE_GEOCODE_CACHE.set(key, result);
      kvSetVenue(key, result); // persist to KV
    }
  } catch {
    // ignore — background task, don't crash
  }
}

// Extract RA event ID from URL
function extractRaEventId(url: string): string | null {
  const match = url.match(/ra\.co\/events\/(\d+)/);
  return match ? match[1] : null;
}

// Fetch venue coordinates from RA GraphQL API
async function fetchRaVenueCoords(eventId: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const cacheKey = `ra-venue-${eventId}`;
  if (RA_VENUE_CACHE.has(cacheKey)) return RA_VENUE_CACHE.get(cacheKey)!;

  try {
    const res = await fetch("https://ra.co/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://ra.co/events",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        query: `{
          event(id: ${eventId}) {
            venue {
              name
              address
              area { name }
              location { latitude longitude }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      RA_VENUE_CACHE.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    const venue = data?.data?.event?.venue;
    if (venue?.location?.latitude && venue?.location?.longitude) {
      const result = {
        lat: venue.location.latitude,
        lng: venue.location.longitude,
        address: venue.address || venue.name || "",
      };
      RA_VENUE_CACHE.set(cacheKey, result);
      return result;
    }
  } catch {
    // ignore
  }
  RA_VENUE_CACHE.set(cacheKey, null);
  return null;
}

function parseEvents(html: string): Omit<EventData, "lat" | "lng">[] {
  const $ = cheerio.load(html);
  const events: Omit<EventData, "lat" | "lng">[] = [];

  $("table tbody tr").each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 6) return;

    const dateTimeHtml = $(cells[0]).html() || "";
    const dateTimeParts = dateTimeHtml.split(/<br\s*\/?>/i);
    const datePart = dateTimeParts[0]?.replace(/<[^>]*>/g, "").trim() || "";
    const timePart = dateTimeParts[1]?.replace(/<[^>]*>/g, "").trim() || "";

    const titleCell = $(cells[1]);
    const eventLink = titleCell.find("a").first();
    const eventUrl = eventLink.attr("href") || "";
    const eventTitle = eventLink.text().trim();

    const fullText = titleCell.text().trim();
    const atMatch = fullText.match(/@\s*(.+)/);
    let venue = "";
    let city = "";
    if (atMatch) {
      const venueAndCity = atMatch[1].trim();
      const cityMatch = venueAndCity.match(/\(([^)]+)\)\s*$/);
      if (cityMatch) {
        city = cityMatch[1].trim();
        venue = venueAndCity.replace(/\([^)]+\)\s*$/, "").trim();
      } else {
        venue = venueAndCity;
      }
    }

    const tags = $(cells[2]).text().trim().split(",").map(t => t.trim()).filter(Boolean);

    const priceAge = $(cells[3]).text().trim();
    const paParts = priceAge.split("|").map(p => p.trim());
    const price = paParts[0] || "";
    const age = paParts[1] || "";

    const organizers = $(cells[4]).text().trim();

    const links: { label: string; url: string }[] = [];
    $(cells[5]).find("a").each((_, a) => {
      const label = $(a).text().trim();
      const url = $(a).attr("href") || "";
      if (label && url) links.push({ label, url });
    });

    if (eventTitle || venue) {
      events.push({
        id: `event-${i}`,
        date: datePart,
        time: timePart,
        title: eventTitle,
        venue,
        city,
        eventUrl,
        tags,
        price,
        age,
        organizers,
        links,
      });
    }
  });

  return events;
}

// In-memory cache with TTL
const DATA_CACHE = new Map<string, { data: EventData[]; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "BayArea";

  const regionInfo = REGIONS.find(r => r.id === region);
  if (!regionInfo) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  // Skip 19hz for regions it doesn't cover (Ticketmaster-only regions)
  if (!regionInfo.has19hz) {
    return NextResponse.json([]);
  }

  // Check cache
  const cached = DATA_CACHE.get(region);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = `https://19hz.info/eventlisting_${region}.php`;
    const res = await fetch(url, {
      headers: { "User-Agent": "bpmlist/1.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch from 19hz.info: ${res.status}` }, { status: 500 });
    }

    const html = await res.text();
    const events = parseEvents(html);

    // Resolve city coords from static lookup
    function resolveCityCoords(rawCity: string): { lat: number; lng: number } | null {
      const regionKey = `${rawCity}|${region}`;
      if (CITY_COORDS[regionKey]) return CITY_COORDS[regionKey];
      if (CITY_COORDS[rawCity]) return CITY_COORDS[rawCity];
      if (rawCity.includes("/")) {
        const parts = rawCity.split("/").map(p => p.trim());
        for (const part of parts) {
          const rk = `${part}|${region}`;
          if (CITY_COORDS[rk]) return CITY_COORDS[rk];
          if (CITY_COORDS[part]) return CITY_COORDS[part];
        }
      }
      return null;
    }

    const cityCoords = new Map<string, { lat: number; lng: number }>();
    for (const event of events) {
      if (!event.city || cityCoords.has(event.city)) continue;
      const coords = resolveCityCoords(event.city);
      if (coords) cityCoords.set(event.city, coords);
    }

    // ---- HOT PATH: fast geocoding (KV bulk check + 3 Nominatim + 5 RA parallel) ----

    // Collect unique venues not in static coords or memory cache
    const unknownVenueKeys: string[] = [];
    const seenVenues = new Set<string>();
    for (const event of events) {
      if (!event.venue || !event.city) continue;
      const key = `${event.venue}|${event.city}`;
      if (seenVenues.has(key)) continue;
      seenVenues.add(key);
      if (VENUE_COORDS[key]) continue;
      if (VENUE_GEOCODE_CACHE.has(key)) continue;
      unknownVenueKeys.push(key);
    }

    // Batch check KV for all unknown venues (single round trip via mget)
    if (unknownVenueKeys.length > 0) {
      try {
        const kvKeys = unknownVenueKeys.map(k => `venue:${k}`);
        const kvResults = await kv.mget<(VenueCoord | null)[]>(...kvKeys);
        for (let i = 0; i < unknownVenueKeys.length; i++) {
          const result = kvResults[i];
          if (result && result.lat && result.lng) {
            VENUE_GEOCODE_CACHE.set(unknownVenueKeys[i], result);
          }
        }
      } catch {
        // KV unavailable — fall through to geocoding APIs
      }
    }

    // After KV check, find venues still needing geocoding
    const venuesNeedingGeocode: { venue: string; city: string; eventUrl: string }[] = [];
    for (const event of events) {
      if (!event.venue || !event.city) continue;
      const key = `${event.venue}|${event.city}`;
      if (VENUE_COORDS[key]) continue;
      if (VENUE_GEOCODE_CACHE.has(key) && VENUE_GEOCODE_CACHE.get(key) !== null) continue;
      // Deduplicate
      if (venuesNeedingGeocode.some(v => `${v.venue}|${v.city}` === key)) continue;
      venuesNeedingGeocode.push({ venue: event.venue, city: event.city, eventUrl: event.eventUrl });
    }

    const MAX_QUICK_GEOCODES = 3;
    const toQuickGeocode = venuesNeedingGeocode.slice(0, MAX_QUICK_GEOCODES);
    for (const { venue, city } of toQuickGeocode) {
      await geocodeVenueQuick(venue, city, regionInfo.state);
    }

    // RA venue coords: 5 in parallel (~1-2s)
    const raEventsToFetch: { index: number; raId: string; venue: string; city: string }[] = [];
    events.forEach((event, i) => {
      if (event.venue && event.city) {
        const venueKey = `${event.venue}|${event.city}`;
        if (VENUE_COORDS[venueKey]) return;
        if (VENUE_GEOCODE_CACHE.get(venueKey)) return;
      }
      const raId = extractRaEventId(event.eventUrl);
      if (raId) { raEventsToFetch.push({ index: i, raId, venue: event.venue, city: event.city }); return; }
      for (const link of event.links) {
        const linkRaId = extractRaEventId(link.url);
        if (linkRaId) { raEventsToFetch.push({ index: i, raId: linkRaId, venue: event.venue, city: event.city }); return; }
      }
    });

    const raResults = new Map<number, { lat: number; lng: number; address: string }>();
    const raToFetch = raEventsToFetch.slice(0, 5);
    if (raToFetch.length > 0) {
      await Promise.allSettled(
        raToFetch.map(async ({ index, raId, venue, city }) => {
          const coords = await fetchRaVenueCoords(raId);
          if (coords) {
            raResults.set(index, coords);
            // Cache for future requests (memory + KV)
            if (venue && city) {
              const vKey = `${venue}|${city}`;
              VENUE_GEOCODE_CACHE.set(vKey, coords);
              kvSetVenue(vKey, coords); // persist to KV
            }
          }
        })
      );
    }

    // ---- BUILD RESPONSE ----

    const geocodedEvents: EventData[] = events.map((event, i) => {
      // Tier 1: Static venue coords
      if (event.venue && event.city) {
        const venueKey = `${event.venue}|${event.city}`;
        const staticVenue = VENUE_COORDS[venueKey];
        if (staticVenue) {
          const jitter = () => (Math.random() - 0.5) * 0.0005;
          return { ...event, lat: staticVenue.lat + jitter(), lng: staticVenue.lng + jitter(), address: staticVenue.address };
        }

        // Tier 2: Geocoded venue cache
        const geocoded = VENUE_GEOCODE_CACHE.get(venueKey);
        if (geocoded) {
          const jitter = () => (Math.random() - 0.5) * 0.0005;
          return { ...event, lat: geocoded.lat + jitter(), lng: geocoded.lng + jitter(), address: geocoded.address };
        }
      }

      // Tier 3: RA venue coords
      const raCoords = raResults.get(i);
      if (raCoords) {
        const jitter = () => (Math.random() - 0.5) * 0.0005;
        return { ...event, lat: raCoords.lat + jitter(), lng: raCoords.lng + jitter(), address: raCoords.address };
      }

      // Tier 4: City-level coords
      if (event.city && cityCoords.has(event.city)) {
        const coords = cityCoords.get(event.city)!;
        if (coords.lat === 0 && coords.lng === 0) {
          const jitter = () => (Math.random() - 0.5) * 0.02;
          return { ...event, lat: regionInfo.center[0] + jitter(), lng: regionInfo.center[1] + jitter() };
        }
        const jitter = () => (Math.random() - 0.5) * 0.008;
        return { ...event, lat: coords.lat + jitter(), lng: coords.lng + jitter() };
      }

      // Tier 5: Region center
      const jitter = () => (Math.random() - 0.5) * 0.02;
      return { ...event, lat: regionInfo.center[0] + jitter(), lng: regionInfo.center[1] + jitter() };
    });

    DATA_CACHE.set(region, { data: geocodedEvents, timestamp: Date.now() });

    // ---- BACKGROUND: deep geocode remaining venues (event page scraping) ----
    // Runs AFTER the response is sent — user doesn't wait for this
    const remainingVenues = venuesNeedingGeocode.slice(MAX_QUICK_GEOCODES);
    if (remainingVenues.length > 0) {
      const bgWork = (async () => {
        // Deep geocode up to 20 more venues in the background
        const toDeepGeocode = remainingVenues.slice(0, 20);
        for (const { venue, city, eventUrl } of toDeepGeocode) {
          const key = `${venue}|${city}`;
          if (VENUE_GEOCODE_CACHE.get(key)) continue; // already resolved by RA
          await geocodeVenueDeep(venue, city, regionInfo.state, eventUrl);
        }
        // Invalidate the data cache so the next request picks up new coords
        DATA_CACHE.delete(region);
      })();

      // Use waitUntil if available (Vercel Edge/Serverless), otherwise fire-and-forget
      const ctx = (request as unknown as { waitUntil?: (p: Promise<unknown>) => void });
      if (ctx.waitUntil) {
        ctx.waitUntil(bgWork);
      } else {
        bgWork.catch(() => {}); // fire and forget
      }
    }

    return NextResponse.json(geocodedEvents);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
