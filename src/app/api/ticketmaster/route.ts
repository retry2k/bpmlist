import { NextRequest, NextResponse } from "next/server";
import { EventData, REGIONS } from "@/types/event";

const API_KEY = process.env.TICKETMASTER_API_KEY;
const DANCE_ELECTRONIC_GENRE_ID = "KnvZfZ7vAvF";
const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

// Cache results per region for 30 minutes
const DATA_CACHE = new Map<string, { data: EventData[]; timestamp: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Map region radius (miles) — wider for spread-out regions
const REGION_RADIUS: Record<string, number> = {
  Texas: 200,
  Iowa: 150,
  BayArea: 50,
  LosAngeles: 50,
  default: 60,
};

function formatDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(localTime: string): string {
  // "20:00:00" → "8:00pm"
  const [h, m] = localTime.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m}${ampm}`;
}

interface TmEvent {
  name: string;
  id: string;
  url: string;
  dates: {
    start: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
    status?: { code: string };
  };
  classifications?: Array<{
    genre?: { name: string };
    subGenre?: { name: string };
  }>;
  images?: Array<{ url: string; ratio?: string; width?: number }>;
  priceRanges?: Array<{ min: number; max: number; currency: string }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: { line1?: string };
      city?: { name: string };
      state?: { stateCode?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
    attractions?: Array<{
      name: string;
      url?: string;
    }>;
  };
}

function mapToEventData(tm: TmEvent, index: number): EventData | null {
  const venue = tm._embedded?.venues?.[0];
  const lat = venue?.location?.latitude ? parseFloat(venue.location.latitude) : undefined;
  const lng = venue?.location?.longitude ? parseFloat(venue.location.longitude) : undefined;

  // Skip events with no coordinates
  if (lat == null || lng == null) return null;

  // Skip cancelled events
  if (tm.dates?.status?.code === "cancelled") return null;

  // Build date string
  let dateStr = "";
  let timeStr = "";
  if (tm.dates?.start?.localDate) {
    const d = new Date(tm.dates.start.localDate + "T12:00:00");
    dateStr = formatDate(d);
  }
  if (tm.dates?.start?.localTime) {
    timeStr = formatTime(tm.dates.start.localTime);
  }

  // Extract genre tags from classifications
  const tags: string[] = [];
  if (tm.classifications) {
    for (const c of tm.classifications) {
      if (c.genre?.name && c.genre.name !== "Undefined") tags.push(c.genre.name.toLowerCase());
      if (c.subGenre?.name && c.subGenre.name !== "Undefined") tags.push(c.subGenre.name.toLowerCase());
    }
  }
  // Ensure at least one electronic tag
  if (tags.length === 0) tags.push("electronic");

  // Build price string
  let price = "";
  if (tm.priceRanges?.[0]) {
    const pr = tm.priceRanges[0];
    if (pr.min === pr.max) {
      price = `$${pr.min}`;
    } else {
      price = `$${pr.min}-$${pr.max}`;
    }
  }

  // Build artists from attractions
  const artists = tm._embedded?.attractions?.map((a) => a.name) || [];

  // Build title: if we have artists, include them
  let title = tm.name;

  // Build links
  const links: { label: string; url: string }[] = [];
  if (tm.url) links.push({ label: "Tickets", url: tm.url });

  const venueName = venue?.name || "";
  const city = venue?.city?.name || "";
  const address = venue?.address?.line1 || "";

  return {
    id: `tm-${tm.id}-${index}`,
    date: dateStr,
    time: timeStr,
    title,
    venue: venueName,
    city,
    eventUrl: tm.url || "",
    tags,
    price,
    age: "",
    organizers: artists.join(", "),
    links,
    address,
    lat,
    lng,
    source: "ticketmaster",
  };
}

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get("region") || "BayArea";

  const regionInfo = REGIONS.find((r) => r.id === regionId);
  if (!regionInfo) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  // Check cache
  const cached = DATA_CACHE.get(regionId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const radius = REGION_RADIUS[regionId] || REGION_RADIUS.default;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30); // 30 days out

    const startStr = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const endStr = endDate.toISOString().replace(/\.\d{3}Z$/, "Z");

    const allEvents: EventData[] = [];
    let page = 0;
    const maxPages = 5; // Max 5 pages = 1000 events

    while (page < maxPages) {
      const params = new URLSearchParams({
        apikey: API_KEY,
        classificationId: DANCE_ELECTRONIC_GENRE_ID,
        geoPoint: `${regionInfo.center[0]},${regionInfo.center[1]}`,
        radius: String(radius),
        unit: "miles",
        startDateTime: startStr,
        endDateTime: endStr,
        size: "200",
        page: String(page),
        sort: "date,asc",
      });

      const res = await fetch(`${BASE_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`Ticketmaster API error: ${res.status}`);
        break;
      }

      const data = await res.json();
      const tmEvents: TmEvent[] = data?._embedded?.events || [];

      if (tmEvents.length === 0) break;

      for (let i = 0; i < tmEvents.length; i++) {
        const mapped = mapToEventData(tmEvents[i], page * 200 + i);
        if (mapped) allEvents.push(mapped);
      }

      const pageInfo = data?.page;
      if (!pageInfo || page >= pageInfo.totalPages - 1) break;
      page++;
    }

    // Deduplicate by similar name + same venue + same date
    const seen = new Set<string>();
    const deduped = allEvents.filter((e) => {
      const key = `${e.title.toLowerCase().substring(0, 30)}|${e.venue.toLowerCase()}|${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    DATA_CACHE.set(regionId, { data: deduped, timestamp: Date.now() });
    return NextResponse.json(deduped);
  } catch (error) {
    console.error("Ticketmaster fetch error:", error);
    return NextResponse.json([]);
  }
}
