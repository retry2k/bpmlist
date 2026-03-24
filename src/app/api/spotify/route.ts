import { NextRequest, NextResponse } from "next/server";

// In-memory cache for RA event artist lookups
const RA_CACHE = new Map<string, ArtistResult[]>();

interface ArtistResult {
  name: string;
  raUrl?: string | null;
  soundcloudUrl?: string | null;
  instagramUrl?: string | null;
  spotifyUrl?: string | null;
  bandcampUrl?: string | null;
  websiteUrl?: string | null;
}

// Extract RA event ID from URL like "https://ra.co/events/2391346"
function extractRaEventId(url: string): string | null {
  const match = url.match(/ra\.co\/events\/(\d+)/);
  return match ? match[1] : null;
}

// Query RA GraphQL API for artist data
async function fetchRaArtists(eventId: string): Promise<ArtistResult[]> {
  const cacheKey = `ra-${eventId}`;
  if (RA_CACHE.has(cacheKey)) return RA_CACHE.get(cacheKey)!;

  try {
    const res = await fetch("https://ra.co/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://ra.co/events",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        query: `{
          event(id: ${eventId}) {
            artists {
              name
              contentUrl
              soundcloud
              instagram
              bandcamp
              website
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      RA_CACHE.set(cacheKey, []);
      return [];
    }

    const data = await res.json();
    const artists = data?.data?.event?.artists;

    if (!artists || artists.length === 0) {
      RA_CACHE.set(cacheKey, []);
      return [];
    }

    const results: ArtistResult[] = artists.map((a: {
      name?: string;
      contentUrl?: string;
      soundcloud?: string;
      instagram?: string;
      bandcamp?: string;
      website?: string;
    }) => ({
      name: a.name || "Unknown",
      raUrl: a.contentUrl ? `https://ra.co${a.contentUrl}` : null,
      soundcloudUrl: a.soundcloud || null,
      instagramUrl: a.instagram || null,
      bandcampUrl: a.bandcamp || null,
      websiteUrl: a.website || null,
      spotifyUrl: null,
    }));

    RA_CACHE.set(cacheKey, results);
    return results;
  } catch {
    RA_CACHE.set(cacheKey, []);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventUrl = searchParams.get("eventUrl") || "";
  const artistsParam = searchParams.get("artists") || "";

  // If we have an RA event URL, use the GraphQL API for real artist data
  const raEventId = extractRaEventId(eventUrl);

  if (raEventId) {
    const raArtists = await fetchRaArtists(raEventId);
    if (raArtists.length > 0) {
      return NextResponse.json({
        source: "ra",
        artists: raArtists.map((a) => ({
          query: a.name,
          found: true,
          name: a.name,
          raUrl: a.raUrl,
          soundcloudUrl: a.soundcloudUrl,
          instagramUrl: a.instagramUrl,
          bandcampUrl: a.bandcampUrl,
          websiteUrl: a.websiteUrl,
          spotifyUrl: a.spotifyUrl,
        })),
      });
    }
  }

  // For non-RA events, just return parsed artist names with no forced lookups
  const artistNames = artistsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (artistNames.length === 0) {
    return NextResponse.json({ source: "parsed", artists: [] });
  }

  return NextResponse.json({
    source: "parsed",
    artists: artistNames.slice(0, 10).map((name) => ({
      query: name,
      found: false,
      name,
    })),
  });
}
