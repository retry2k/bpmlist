import { NextRequest, NextResponse } from "next/server";

// In-memory cache for Spotify results
const SPOTIFY_CACHE = new Map<
  string,
  {
    name: string;
    spotifyUrl: string;
    imageUrl: string | null;
    previewUrl: string | null;
    topTrackName: string | null;
  } | null
>();

// Token cache
let accessToken: string | null = null;
let tokenExpiry = 0;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  // Reuse valid token
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
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 60s early
    return accessToken;
  } catch {
    return null;
  }
}

async function searchArtist(
  name: string,
  token: string,
): Promise<{
  name: string;
  spotifyUrl: string;
  imageUrl: string | null;
  previewUrl: string | null;
  topTrackName: string | null;
} | null> {
  const cacheKey = name.toLowerCase();
  if (SPOTIFY_CACHE.has(cacheKey)) return SPOTIFY_CACHE.get(cacheKey)!;

  try {
    // Search for artist
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const artists = searchData.artists?.items;
    if (!artists || artists.length === 0) {
      SPOTIFY_CACHE.set(cacheKey, null);
      return null;
    }

    // Pick best match - prefer exact name match, then highest popularity
    let best = artists[0];
    for (const a of artists) {
      if (a.name.toLowerCase() === name.toLowerCase()) {
        best = a;
        break;
      }
    }

    const artistId = best.id;
    const spotifyUrl = best.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`;
    const imageUrl = best.images?.[best.images.length - 1]?.url || null; // smallest image

    // Get top tracks for preview
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
          // Find first track with a preview URL
          for (const track of tracks) {
            if (track.preview_url) {
              previewUrl = track.preview_url;
              topTrackName = track.name;
              break;
            }
          }
          // Even if no preview, store the top track name
          if (!topTrackName && tracks[0]) {
            topTrackName = tracks[0].name;
          }
        }
      }
    } catch {
      // Ignore - we still have the artist info
    }

    const result = {
      name: best.name,
      spotifyUrl,
      imageUrl,
      previewUrl,
      topTrackName,
    };

    SPOTIFY_CACHE.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
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

  const token = await getSpotifyToken();
  if (!token) {
    return NextResponse.json({
      error: "Spotify API not configured",
      artists: artistNames.map((name) => ({
        query: name,
        found: false,
      })),
    });
  }

  // Search for each artist (limit to 8 to avoid rate limits)
  const results = [];
  for (const name of artistNames.slice(0, 8)) {
    const result = await searchArtist(name, token);
    results.push({
      query: name,
      found: !!result,
      ...(result || {}),
    });
  }

  return NextResponse.json({ artists: results });
}
