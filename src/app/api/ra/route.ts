import { NextRequest, NextResponse } from "next/server";
import { EventData } from "@/types/event";

// RA area code mapping: region ID -> RA area code
const RA_AREA_CODES: Record<string, number> = {
  BayArea: 13,
  LosAngeles: 17,
  NYC: 8,
  CHI: 48,
  Detroit: 30,
  Seattle: 24,
  Miami: 7,
  DC: 49,
  Toronto: 79,
  Denver: 68,
  ORE: 80,
  Atlanta: 51,
  LasVegas: 60,
  Phoenix: 103,
  Massachusetts: 43,
  BC: 77,
  Montreal: 78,
  Philadelphia: 46,
  Minneapolis: 55,
  Nashville: 97,
  NewOrleans: 44,
  SanDiego: 89,
  Orlando: 45,
  Charlotte: 164,
  Pittsburgh: 184,
};

const GET_EVENT_LISTINGS = `
query GET_EVENT_LISTINGS(
  $filters: FilterInputDtoInput
  $filterOptions: FilterOptionsInputDtoInput
  $page: Int
  $pageSize: Int
) {
  eventListings(
    filters: $filters
    filterOptions: $filterOptions
    page: $page
    pageSize: $pageSize
  ) {
    data {
      id
      listingDate
      event {
        id
        title
        date
        startTime
        endTime
        contentUrl
        flyerFront
        images {
          filename
        }
        venue {
          id
          name
          address
          contentUrl
          area {
            name
          }
          location {
            latitude
            longitude
          }
        }
        artists {
          id
          name
        }
        interestedCount
        attending
      }
    }
    totalResults
  }
}
`;

// In-memory cache with TTL
const DATA_CACHE = new Map<string, { data: EventData[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Format date string like "Sat, Mar 29"
function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  } catch {
    return dateStr;
  }
}

// Format time like "10pm-4am"
function formatEventTime(startTime: string | null, endTime: string | null): string {
  const formatSingle = (t: string | null): string => {
    if (!t) return "";
    try {
      const d = new Date(t);
      let hours = d.getUTCHours();
      const minutes = d.getUTCMinutes();
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      if (minutes > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}${ampm}`;
      }
      return `${hours}${ampm}`;
    } catch {
      return "";
    }
  };

  const start = formatSingle(startTime);
  const end = formatSingle(endTime);

  if (start && end) return `${start}-${end}`;
  if (start) return start;
  return "";
}

interface RaEventListing {
  id: string;
  listingDate: string;
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    contentUrl: string;
    flyerFront: string | null;
    images: { filename: string }[];
    venue: {
      id: string;
      name: string;
      address: string;
      contentUrl: string;
      area: { name: string } | null;
      location: { latitude: number; longitude: number } | null;
    } | null;
    artists: { id: string; name: string }[];
    interestedCount: number;
    attending: number;
  };
}

async function fetchRaPage(
  areaCode: number,
  page: number,
  dateGte: string,
  dateLte: string
): Promise<RaEventListing[]> {
  const variables = {
    filters: {
      areas: { eq: areaCode },
      listingDate: {
        gte: dateGte,
        lte: dateLte,
      },
    },
    filterOptions: { genre: true },
    pageSize: 20,
    page,
  };

  const res = await fetch("https://ra.co/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://ra.co/events",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    body: JSON.stringify({
      query: GET_EVENT_LISTINGS,
      variables,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.error(`RA API returned ${res.status} for page ${page}`);
    return [];
  }

  const json = await res.json();
  const listings = json?.data?.eventListings?.data;
  if (!Array.isArray(listings)) return [];
  return listings;
}

function mapToEventData(listing: RaEventListing): EventData {
  const event = listing.event;
  const venue = event.venue;

  // Build title: event title + artist names if available
  let title = event.title;
  if (event.artists && event.artists.length > 0) {
    const artistNames = event.artists.map((a) => a.name).join(", ");
    // Only append if artists aren't already in the title
    if (!title.toLowerCase().includes(artistNames.toLowerCase().substring(0, 10))) {
      title = `${title} - ${artistNames}`;
    }
  }

  return {
    id: `ra-${event.id}`,
    date: formatEventDate(event.date),
    time: formatEventTime(event.startTime, event.endTime),
    title,
    venue: venue?.name || "",
    city: venue?.area?.name || "",
    eventUrl: `https://ra.co${event.contentUrl}`,
    tags: ["electronic"],
    price: "",
    age: "",
    organizers: "",
    links: [],
    lat: venue?.location?.latitude,
    lng: venue?.location?.longitude,
    address: venue?.address || "",
    source: "ra",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "BayArea";

  const areaCode = RA_AREA_CODES[region];
  if (!areaCode) {
    return NextResponse.json([]);
  }

  // Check cache
  const cached = DATA_CACHE.get(region);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const now = new Date();
    const dateGte = now.toISOString();
    const future = new Date(now);
    future.setDate(future.getDate() + 30);
    const dateLte = future.toISOString();

    const allListings: RaEventListing[] = [];

    // Fetch up to 3 pages with 500ms delay between pages
    for (let page = 1; page <= 3; page++) {
      try {
        const listings = await fetchRaPage(areaCode, page, dateGte, dateLte);
        allListings.push(...listings);

        // Stop if we got fewer than a full page
        if (listings.length < 20) break;

        // 500ms delay between pages
        if (page < 3) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        console.error(`RA fetch error page ${page}:`, err);
        break;
      }
    }

    const events = allListings.map(mapToEventData);

    // Cache results
    DATA_CACHE.set(region, { data: events, timestamp: Date.now() });

    return NextResponse.json(events);
  } catch (err) {
    console.error("RA API error:", err);
    return NextResponse.json([]);
  }
}
