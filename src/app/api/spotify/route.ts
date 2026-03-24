import { NextRequest, NextResponse } from "next/server";

// In-memory cache for RA event data
const RA_CACHE = new Map<string, { artists: ArtistResult[]; imageUrl: string | null }>();

interface ArtistResult {
  name: string;
  raUrl?: string | null;
  soundcloudUrl?: string | null;
  instagramUrl?: string | null;
  spotifyUrl?: string | null;
  bandcampUrl?: string | null;
  websiteUrl?: string | null;
  previewUrl?: string | null;
  topTrackName?: string | null;
}

// In-memory cache for Deezer previews
const DEEZER_CACHE = new Map<string, { previewUrl: string; trackName: string } | null>();

// Normalize name for comparison
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function isNameMatch(query: string, resultName: string): boolean {
  const q = normalizeName(query);
  const s = normalizeName(resultName);
  if (q === s) return true;
  if (q.includes(s) || s.includes(q)) return true;
  const qWords = q.split(" ").filter(Boolean);
  const sWords = s.split(" ").filter(Boolean);
  if (qWords.length > 0 && qWords.every(w => s.includes(w))) return true;
  if (sWords.length > 0 && sWords.every(w => q.includes(w))) return true;
  return false;
}

// Search Deezer for preview - only return if artist name matches
async function searchDeezer(name: string): Promise<{ previewUrl: string; trackName: string } | null> {
  const cacheKey = name.toLowerCase();
  if (DEEZER_CACHE.has(cacheKey)) return DEEZER_CACHE.get(cacheKey)!;

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=artist:"${encodeURIComponent(name)}"&limit=10`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data.data;
    if (!tracks || tracks.length === 0) {
      DEEZER_CACHE.set(cacheKey, null);
      return null;
    }

    for (const track of tracks) {
      if (track.preview && track.artist?.name && isNameMatch(name, track.artist.name)) {
        const result = { previewUrl: track.preview, trackName: track.title };
        DEEZER_CACHE.set(cacheKey, result);
        return result;
      }
    }
    DEEZER_CACHE.set(cacheKey, null);
    return null;
  } catch {
    return null;
  }
}

// Extract RA event ID from URL like "https://ra.co/events/2391346"
function extractRaEventId(url: string): string | null {
  const match = url.match(/ra\.co\/events\/(\d+)/);
  return match ? match[1] : null;
}

// Query RA GraphQL API for event data (artists + image)
async function fetchRaEvent(eventId: string): Promise<{ artists: ArtistResult[]; imageUrl: string | null }> {
  const cacheKey = `ra-${eventId}`;
  if (RA_CACHE.has(cacheKey)) return RA_CACHE.get(cacheKey)!;

  const empty = { artists: [], imageUrl: null };

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
            flyerFront
            images { filename }
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
      RA_CACHE.set(cacheKey, empty);
      return empty;
    }

    const data = await res.json();
    const event = data?.data?.event;
    if (!event) {
      RA_CACHE.set(cacheKey, empty);
      return empty;
    }

    // Get event image: prefer flyerFront, then first image
    const imageUrl = event.flyerFront
      || (event.images && event.images.length > 0 ? event.images[0].filename : null);

    const artists = event.artists || [];
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

    const result = { artists: results, imageUrl };
    RA_CACHE.set(cacheKey, result);
    return result;
  } catch {
    RA_CACHE.set(cacheKey, empty);
    return empty;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventUrl = searchParams.get("eventUrl") || "";
  const artistsParam = searchParams.get("artists") || "";

  // If we have an RA event URL, use the GraphQL API for real artist data
  const raEventId = extractRaEventId(eventUrl);

  if (raEventId) {
    const raData = await fetchRaEvent(raEventId);
    if (raData.artists.length > 0 || raData.imageUrl) {
      // Fetch Deezer previews in parallel for all RA artists (name is verified)
      const withPreviews = await Promise.all(
        raData.artists.slice(0, 8).map(async (a) => {
          const deezer = await searchDeezer(a.name);
          return {
            query: a.name,
            found: true,
            name: a.name,
            raUrl: a.raUrl,
            soundcloudUrl: a.soundcloudUrl,
            instagramUrl: a.instagramUrl,
            bandcampUrl: a.bandcampUrl,
            websiteUrl: a.websiteUrl,
            spotifyUrl: a.spotifyUrl,
            previewUrl: deezer?.previewUrl || null,
            topTrackName: deezer?.trackName || null,
          };
        }),
      );
      return NextResponse.json({ source: "ra", artists: withPreviews, imageUrl: raData.imageUrl });
    }
  }

  // For non-RA events, try Deezer previews with strict name matching
  const artistNames = artistsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (artistNames.length === 0) {
    return NextResponse.json({ source: "parsed", artists: [] });
  }

  const results = await Promise.all(
    artistNames.slice(0, 8).map(async (name) => {
      const deezer = await searchDeezer(name);
      return {
        query: name,
        found: !!deezer,
        name,
        previewUrl: deezer?.previewUrl || null,
        topTrackName: deezer?.trackName || null,
      };
    }),
  );

  return NextResponse.json({ source: "parsed", artists: results });
}
