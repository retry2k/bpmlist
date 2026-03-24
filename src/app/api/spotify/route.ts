import { NextRequest, NextResponse } from "next/server";

// In-memory cache for results
const ARTIST_CACHE = new Map<
  string,
  {
    name: string;
    spotifyUrl: string | null;
    soundcloudUrl: string | null;
    previewUrl: string | null;
    topTrackName: string | null;
  } | null
>();

// Spotify token cache
let accessToken: string | null = null;
let tokenExpiry = 0;

// Normalize a name for comparison: lowercase, remove special chars, collapse spaces
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Check if Spotify result name closely matches the query
function isNameMatch(query: string, spotifyName: string): boolean {
  const q = normalizeName(query);
  const s = normalizeName(spotifyName);

  // Exact match
  if (q === s) return true;

  // One contains the other
  if (q.includes(s) || s.includes(q)) return true;

  // Check if all words of the query appear in the spotify name or vice versa
  const qWords = q.split(" ").filter(Boolean);
  const sWords = s.split(" ").filter(Boolean);

  // All query words found in spotify name
  if (qWords.length > 0 && qWords.every(w => s.includes(w))) return true;
  // All spotify words found in query
  if (sWords.length > 0 && sWords.every(w => q.includes(w))) return true;

  // Levenshtein-like: if names are short and differ by ≤2 chars
  if (Math.abs(q.length - s.length) <= 2 && q.length <= 20) {
    let diffs = 0;
    const maxLen = Math.max(q.length, s.length);
    for (let i = 0; i < maxLen; i++) {
      if (q[i] !== s[i]) diffs++;
      if (diffs > 2) break;
    }
    if (diffs <= 2) return true;
  }

  return false;
}

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

// Search Spotify for artist - only return if name closely matches
async function searchSpotify(
  name: string,
  token: string,
): Promise<{ name: string; spotifyUrl: string; previewUrl: string | null; topTrackName: string | null } | null> {
  try {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const artists = searchData.artists?.items;
    if (!artists || artists.length === 0) return null;

    // Find best matching artist - must pass name validation
    let best = null;
    for (const a of artists) {
      if (isNameMatch(name, a.name)) {
        best = a;
        break;
      }
    }

    // No close match found - don't link wrong artist
    if (!best) return null;

    const artistId = best.id;
    const spotifyUrl = best.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`;

    // Try to get preview
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

    return { name: best.name, spotifyUrl, previewUrl, topTrackName };
  } catch {
    return null;
  }
}

// Search Deezer for audio preview (free, no API key, reliable 30-sec previews)
// Only return if artist name closely matches
async function searchDeezer(
  name: string,
): Promise<{ previewUrl: string; trackName: string } | null> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=artist:"${encodeURIComponent(name)}"&limit=10`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data.data;
    if (!tracks || tracks.length === 0) return null;

    for (const track of tracks) {
      if (track.preview && track.artist?.name) {
        // Validate artist name matches
        if (isNameMatch(name, track.artist.name)) {
          return { previewUrl: track.preview, trackName: track.title };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Search SoundCloud for artist page
async function searchSoundCloud(
  name: string,
): Promise<string | null> {
  try {
    // Use SoundCloud's public search page and check if we can resolve a profile
    // SoundCloud doesn't have a free API anymore, so we search via their widget/resolve
    // We'll construct a likely profile URL based on the name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .trim();

    if (!slug) return null;

    // Try to resolve the SoundCloud URL
    const resolveUrl = `https://soundcloud.com/${slug}`;
    const res = await fetch(resolveUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return resolveUrl;
    }

    // Also try with "dj" prefix which is common
    if (!slug.startsWith("dj")) {
      const djSlug = `dj${slug.replace(/^dj-?/, "")}`;
      const res2 = await fetch(`https://soundcloud.com/${djSlug}`, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(3000),
      });
      if (res2.ok) {
        return `https://soundcloud.com/${djSlug}`;
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
  soundcloudUrl: string | null;
  previewUrl: string | null;
  topTrackName: string | null;
} | null> {
  const cacheKey = name.toLowerCase();
  if (ARTIST_CACHE.has(cacheKey)) return ARTIST_CACHE.get(cacheKey)!;

  // Run Spotify + Deezer + SoundCloud in parallel
  const [spotifyResult, deezerResult, soundcloudUrl] = await Promise.all([
    spotifyToken ? searchSpotify(name, spotifyToken) : Promise.resolve(null),
    searchDeezer(name),
    searchSoundCloud(name),
  ]);

  if (!spotifyResult && !deezerResult && !soundcloudUrl) {
    ARTIST_CACHE.set(cacheKey, null);
    return null;
  }

  const result = {
    name: spotifyResult?.name || name,
    spotifyUrl: spotifyResult?.spotifyUrl || null,
    soundcloudUrl,
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
