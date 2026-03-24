import { NextRequest, NextResponse } from "next/server";

// In-memory cache for results
const ARTIST_CACHE = new Map<
  string,
  {
    name: string;
    spotifyUrl: string | null;
    previewUrl: string | null;
    topTrackName: string | null;
  } | null
>();

// Spotify token cache
let accessToken: string | null = null;
let tokenExpiry = 0;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) return null;
    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return accessToken;
  } catch {
    return null;
  }
}

// Search Spotify for artist profile link
async function searchSpotify(
  name: string,
  token: string,
): Promise<{ spotifyUrl: string; previewUrl: string | null; topTrackName: string | null } | null> {
  try {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const artists = searchData.artists?.items;
    if (!artists || artists.length === 0) return null;

    // Pick best match - prefer exact name match
    let best = artists[0];
    for (const a of artists) {
      if (a.name.toLowerCase() === name.toLowerCase()) {
        best = a;
        break;
      }
    }

    const artistId = best.id;
    const spotifyUrl = best.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`;

    // Try to get Spotify preview (some tracks still have them)
    let previewUrl: string | null = null;
    let topTrackName: string | null = null;
    try {
      const tracksRes = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json();
        const tracks = tracksData.tracks;
        if (tracks && tracks.length > 0) {
          for (const track of tracks) {
            if (track.preview_url) {
              previewUrl = track.preview_url;
              topTrackName = track.name;
              break;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return { spotifyUrl, previewUrl, topTrackName };
  } catch {
    return null;
  }
}

// Search Deezer for audio preview (free, no API key, reliable 30-sec previews)
async function searchDeezer(
  name: string,
): Promise<{ previewUrl: string; trackName: string } | null> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=artist:"${encodeURIComponent(name)}"&limit=5`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data.data;
    if (!tracks || tracks.length === 0) return null;

    // Find first track with a preview
    for (const track of tracks) {
      if (track.preview) {
        return { previewUrl: track.preview, trackName: track.title };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveArtist(
  name: string,
  spotifyToken: string | null,
): Promise<{
  name: string;
  spotifyUrl: string | null;
  previewUrl: string | null;
  topTrackName: string | null;
} | null> {
  const cacheKey = name.toLowerCase();
  if (ARTIST_CACHE.has(cacheKey)) return ARTIST_CACHE.get(cacheKey)!;

  // Run Spotify + Deezer in parallel
  const [spotifyResult, deezerResult] = await Promise.all([
    spotifyToken ? searchSpotify(name, spotifyToken) : Promise.resolve(null),
    searchDeezer(name),
  ]);

  if (!spotifyResult && !deezerResult) {
    ARTIST_CACHE.set(cacheKey, null);
    return null;
  }

  const result = {
    name,
    spotifyUrl: spotifyResult?.spotifyUrl || null,
    // Prefer Deezer preview (more reliable), fall back to Spotify preview
    previewUrl: deezerResult?.previewUrl || spotifyResult?.previewUrl || null,
    topTrackName: deezerResult?.trackName || spotifyResult?.topTrackName || null,
  };

  ARTIST_CACHE.set(cacheKey, result);
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistsParam = searchParams.get("artists");

  if (!artistsParam) {
    return NextResponse.json({ error: "Missing artists parameter" }, { status: 400 });
  }

  const artistNames = artistsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (artistNames.length === 0) {
    return NextResponse.json({ artists: [] });
  }

  const spotifyToken = await getSpotifyToken();

  // Search for each artist (limit to 8)
  const results = [];
  for (const name of artistNames.slice(0, 8)) {
    const result = await resolveArtist(name, spotifyToken);
    results.push({
      query: name,
      found: !!result,
      ...(result || {}),
    });
  }

  return NextResponse.json({ artists: results });
}
