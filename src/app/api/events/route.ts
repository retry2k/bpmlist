import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { EventData } from "@/types/event";
import { REGIONS } from "@/types/event";
import { CITY_COORDS } from "@/lib/city-coords";
import { VENUE_COORDS } from "@/lib/venue-coords";

// Persistent venue geocode cache (survives across requests, separate from data cache)
const VENUE_GEOCODE_CACHE = new Map<string, { lat: number; lng: number; address: string } | null>();

// Rate limit tracking for Nominatim
let lastGeocode = 0;

async function geocodeVenue(
  venueName: string,
  city: string,
  state: string,
  regionCenter: [number, number],
): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = `${venueName}|${city}`;
  if (VENUE_GEOCODE_CACHE.has(key)) return VENUE_GEOCODE_CACHE.get(key)!;

  try {
    // Rate limit: 1 request per second
    const now = Date.now();
    const wait = Math.max(0, 1100 - (now - lastGeocode));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeocode = Date.now();

    const query = `${venueName}, ${city}, ${state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "bpmlist/1.0 (event map)" },
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (data && data.length > 0) {
      // Pick result closest to region center
      let best: { lat: number; lng: number; address: string } | null = null;
      let bestDist = Infinity;
      for (const item of data) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const dlat = lat - regionCenter[0];
        const dlng = lng - regionCenter[1];
        const dist = dlat * dlat + dlng * dlng;
        if (dist < bestDist) {
          bestDist = dist;
          // Extract a clean address from display_name
          const parts = (item.display_name || "").split(",").map((s: string) => s.trim());
          const address = parts.slice(0, 3).join(", ");
          best = { lat, lng, address };
        }
      }
      // Only accept if within ~50km of region center (roughly 0.5 degrees)
      if (best && bestDist < 0.25) {
        VENUE_GEOCODE_CACHE.set(key, best);
        return best;
      }
    }
  } catch {
    // ignore - rate limited or network error
  }
  VENUE_GEOCODE_CACHE.set(key, null);
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

    // Resolve city coordinates
    const cityCoords = new Map<string, { lat: number; lng: number }>();
    for (const event of events) {
      if (!event.city || cityCoords.has(event.city)) continue;
      const coords = resolveCityCoords(event.city);
      if (coords) cityCoords.set(event.city, coords);
    }

    // Collect unique venues that need geocoding
    const venuesNeedingGeocode: { venue: string; city: string }[] = [];
    const seenVenues = new Set<string>();
    for (const event of events) {
      if (!event.venue || !event.city) continue;
      const key = `${event.venue}|${event.city}`;
      if (seenVenues.has(key)) continue;
      seenVenues.add(key);
      // Skip if we already have static coords or cached geocode
      if (VENUE_COORDS[key]) continue;
      if (VENUE_GEOCODE_CACHE.has(key)) continue;
      venuesNeedingGeocode.push({ venue: event.venue, city: event.city });
    }

    // Progressively geocode up to 5 unknown venues per request
    const MAX_GEOCODES = 5;
    const toGeocode = venuesNeedingGeocode.slice(0, MAX_GEOCODES);
    if (toGeocode.length > 0) {
      for (const { venue, city } of toGeocode) {
        await geocodeVenue(venue, city, regionInfo.state, regionInfo.center);
      }
    }

    // Assign coordinates to events
    const geocodedEvents: EventData[] = events.map((event) => {
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

      // Fall back to city-level coords with larger jitter
      if (event.city && cityCoords.has(event.city)) {
        const coords = cityCoords.get(event.city)!;
        if (coords.lat === 0 && coords.lng === 0) {
          const jitter = () => (Math.random() - 0.5) * 0.02;
          return { ...event, lat: regionInfo.center[0] + jitter(), lng: regionInfo.center[1] + jitter() };
        }
        const jitter = () => (Math.random() - 0.5) * 0.025;
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
