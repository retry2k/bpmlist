import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { EventData } from "@/types/event";
import { REGIONS } from "@/types/event";
import { CITY_COORDS } from "@/lib/city-coords";
import { VENUE_COORDS } from "@/lib/venue-coords";

// Cache for cities not in the static lookup
const GEOCODE_CACHE = new Map<string, { lat: number; lng: number } | null>();

async function geocodeCity(
  city: string,
  state: string,
  regionCenter: [number, number],
): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${city}|${state}`;
  if (GEOCODE_CACHE.has(cacheKey)) return GEOCODE_CACHE.get(cacheKey)!;

  try {
    const query = `${city}, ${state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PartyFinder/1.0 (event map)" },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data && data.length > 0) {
      // Pick closest result to region center
      let best: { lat: number; lng: number } | null = null;
      let bestDist = Infinity;
      for (const item of data) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const dlat = lat - regionCenter[0];
        const dlng = lng - regionCenter[1];
        const dist = dlat * dlat + dlng * dlng;
        if (dist < bestDist) {
          bestDist = dist;
          best = { lat, lng };
        }
      }
      GEOCODE_CACHE.set(cacheKey, best);
      return best;
    }
  } catch {
    // ignore - rate limited or network error
  }
  GEOCODE_CACHE.set(cacheKey, null);
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

  // Check cache
  const cached = DATA_CACHE.get(region);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = `https://19hz.info/eventlisting_${region}.php`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PartyFinder/1.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch from 19hz.info: ${res.status}` }, { status: 500 });
    }

    const html = await res.text();
    const events = parseEvents(html);

    // Resolve city coordinates: static lookup first, then Nominatim for unknowns
    const cityCoords = new Map<string, { lat: number; lng: number }>();
    const unknownCities = new Set<string>();

    for (const event of events) {
      if (!event.city) continue;
      if (cityCoords.has(event.city)) continue;

      if (CITY_COORDS[event.city]) {
        cityCoords.set(event.city, CITY_COORDS[event.city]);
      } else {
        unknownCities.add(event.city);
      }
    }

    // Skip Nominatim geocoding to avoid timeouts on serverless
    // Unknown cities fall back to region center with jitter

    // Assign coordinates to events: venue-level first, then city-level with jitter
    const geocodedEvents: EventData[] = events.map((event) => {
      // Try exact venue match first (VenueName|City format)
      if (event.venue && event.city) {
        const venueKey = `${event.venue}|${event.city}`;
        const venueCoords = VENUE_COORDS[venueKey];
        if (venueCoords) {
          // Tiny jitter so overlapping venue events don't stack exactly
          const jitter = () => (Math.random() - 0.5) * 0.0005;
          return { ...event, lat: venueCoords.lat + jitter(), lng: venueCoords.lng + jitter() };
        }
      }

      // Fall back to city-level coords with larger jitter
      if (event.city && cityCoords.has(event.city)) {
        const coords = cityCoords.get(event.city)!;
        // Skip invalid coords (like TBA with 0,0)
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
