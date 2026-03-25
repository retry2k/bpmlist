import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { EventData } from "@/types/event";
import { REGIONS } from "@/types/event";
import { CITY_COORDS } from "@/lib/city-coords";
import { VENUE_COORDS } from "@/lib/venue-coords";

// Persistent venue geocode cache (survives across requests, separate from data cache)
const VENUE_GEOCODE_CACHE = new Map<string, { lat: number; lng: number; address: string } | null>();

// Cache for RA venue coordinates
const RA_VENUE_CACHE = new Map<string, { lat: number; lng: number; address: string } | null>();

// Rate limit tracking for Nominatim
let lastGeocode = 0;

async function geocodeVenue(
  venueName: string,
  city: string,
  state: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = `${venueName}|${city}`;
  if (VENUE_GEOCODE_CACHE.has(key)) return VENUE_GEOCODE_CACHE.get(key)!;

  try {
    // Rate limit: 1 request per second
    const now = Date.now();
    const wait = Math.max(0, 1100 - (now - lastGeocode));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeocode = Date.now();

    // Try with full venue + city + state first
    const query = `${venueName}, ${city}, ${state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "bpmlist/1.0 (event map)" },
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (data && data.length > 0) {
      // Pick the first result — Nominatim already ranks by relevance
      // and our query includes city+state for disambiguation
      const item = data[0];
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const parts = (item.display_name || "").split(",").map((s: string) => s.trim());
      const address = parts.slice(0, 3).join(", ");
      const result = { lat, lng, address };
      VENUE_GEOCODE_CACHE.set(key, result);
      return result;
    }
  } catch {
    // ignore - rate limited or network error
  }
  VENUE_GEOCODE_CACHE.set(key, null);
  return null;
}

// Geocode a city name to get coordinates
async function geocodeCity(
  city: string,
  state: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const now = Date.now();
    const wait = Math.max(0, 1100 - (now - lastGeocode));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeocode = Date.now();

    const query = `${city}, ${state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&featuretype=city`;
    const res = await fetch(url, {
      headers: { "User-Agent": "bpmlist/1.0 (event map)" },
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // ignore
  }
  return null;
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
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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

    // Helper: resolve city coords handling compound names like "Venice/Los Angeles"
    function resolveCityCoords(rawCity: string): { lat: number; lng: number } | null {
      // Try region-specific key first
      const regionKey = `${rawCity}|${region}`;
      if (CITY_COORDS[regionKey]) return CITY_COORDS[regionKey];
      if (CITY_COORDS[rawCity]) return CITY_COORDS[rawCity];

      // Handle compound city names: "Venice/Los Angeles" -> try "Venice" first
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

    // Resolve city coordinates — and geocode unknown cities
    const cityCoords = new Map<string, { lat: number; lng: number }>();
    const unknownCities: string[] = [];
    for (const event of events) {
      if (!event.city || cityCoords.has(event.city)) continue;
      const coords = resolveCityCoords(event.city);
      if (coords) {
        cityCoords.set(event.city, coords);
      } else {
        unknownCities.push(event.city);
      }
    }

    // Geocode up to 10 unknown cities
    const uniqueUnknownCities = [...new Set(unknownCities)].slice(0, 10);
    for (const city of uniqueUnknownCities) {
      const coords = await geocodeCity(city, regionInfo.state);
      if (coords) {
        cityCoords.set(city, coords);
      }
    }

    // Collect unique venues that need geocoding
    const venuesNeedingGeocode: { venue: string; city: string }[] = [];
    const seenVenues = new Set<string>();
    for (const event of events) {
      if (!event.venue || !event.city) continue;
      const key = `${event.venue}|${event.city}`;
      if (seenVenues.has(key)) continue;
      seenVenues.add(key);
      if (VENUE_COORDS[key]) continue;
      if (VENUE_GEOCODE_CACHE.has(key)) continue;
      venuesNeedingGeocode.push({ venue: event.venue, city: event.city });
    }

    // Geocode up to 30 unknown venues per request (was 5)
    const MAX_GEOCODES = 30;
    const toGeocode = venuesNeedingGeocode.slice(0, MAX_GEOCODES);
    for (const { venue, city } of toGeocode) {
      await geocodeVenue(venue, city, regionInfo.state);
    }

    // Collect RA event IDs for events that still don't have coords
    // (no static, no geocode cache, no city coords)
    const raEventsToFetch: { index: number; raId: string }[] = [];
    events.forEach((event, i) => {
      // Skip if we already have coords from static or geocode
      if (event.venue && event.city) {
        const venueKey = `${event.venue}|${event.city}`;
        if (VENUE_COORDS[venueKey]) return;
        if (VENUE_GEOCODE_CACHE.get(venueKey)) return;
      }

      // Check if this event or its links have an RA URL
      const raId = extractRaEventId(event.eventUrl);
      if (raId) {
        raEventsToFetch.push({ index: i, raId });
        return;
      }
      for (const link of event.links) {
        const linkRaId = extractRaEventId(link.url);
        if (linkRaId) {
          raEventsToFetch.push({ index: i, raId: linkRaId });
          return;
        }
      }
    });

    // Fetch RA venue coords in parallel (limit to 15 to avoid overwhelming RA)
    const raResults = new Map<number, { lat: number; lng: number; address: string }>();
    const raToFetch = raEventsToFetch.slice(0, 15);
    if (raToFetch.length > 0) {
      const results = await Promise.allSettled(
        raToFetch.map(async ({ index, raId }) => {
          const coords = await fetchRaVenueCoords(raId);
          if (coords) raResults.set(index, coords);
        })
      );
      // Suppress unused variable warning
      void results;
    }

    // Assign coordinates to events
    const geocodedEvents: EventData[] = events.map((event, i) => {
      // Try exact venue match first (static coords)
      if (event.venue && event.city) {
        const venueKey = `${event.venue}|${event.city}`;
        const staticVenue = VENUE_COORDS[venueKey];
        if (staticVenue) {
          const jitter = () => (Math.random() - 0.5) * 0.0005;
          return {
            ...event,
            lat: staticVenue.lat + jitter(),
            lng: staticVenue.lng + jitter(),
            address: staticVenue.address,
          };
        }

        // Try geocoded venue cache
        const geocoded = VENUE_GEOCODE_CACHE.get(venueKey);
        if (geocoded) {
          const jitter = () => (Math.random() - 0.5) * 0.0005;
          return {
            ...event,
            lat: geocoded.lat + jitter(),
            lng: geocoded.lng + jitter(),
            address: geocoded.address,
          };
        }
      }

      // Try RA venue coordinates
      const raCoords = raResults.get(i);
      if (raCoords) {
        const jitter = () => (Math.random() - 0.5) * 0.0005;
        // Cache this for future requests
        if (event.venue && event.city) {
          const key = `${event.venue}|${event.city}`;
          VENUE_GEOCODE_CACHE.set(key, raCoords);
        }
        return {
          ...event,
          lat: raCoords.lat + jitter(),
          lng: raCoords.lng + jitter(),
          address: raCoords.address,
        };
      }

      // Fall back to city-level coords with larger jitter
      if (event.city && cityCoords.has(event.city)) {
        const coords = cityCoords.get(event.city)!;
        if (coords.lat === 0 && coords.lng === 0) {
          const jitter = () => (Math.random() - 0.5) * 0.02;
          return { ...event, lat: regionInfo.center[0] + jitter(), lng: regionInfo.center[1] + jitter() };
        }
        const jitter = () => (Math.random() - 0.5) * 0.008;
        return { ...event, lat: coords.lat + jitter(), lng: coords.lng + jitter() };
      }

      // Fallback: region center
      const jitter = () => (Math.random() - 0.5) * 0.02;
      return {
        ...event,
        lat: regionInfo.center[0] + jitter(),
        lng: regionInfo.center[1] + jitter(),
      };
    });

    DATA_CACHE.set(region, { data: geocodedEvents, timestamp: Date.now() });

    return NextResponse.json(geocodedEvents);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
