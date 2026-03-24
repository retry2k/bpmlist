import { NextRequest, NextResponse } from "next/server";

interface ArtistDetails {
  name: string;
  bio: string | null;
  imageUrl: string | null;
  country: string | null;
  raUrl: string | null;
  soundcloudUrl: string | null;
  instagramUrl: string | null;
  bandcampUrl: string | null;
  websiteUrl: string | null;
  followers: number | null;
  aliases: string | null;
}

// In-memory cache for artist details
const ARTIST_CACHE = new Map<string, ArtistDetails | null>();

// Extract RA artist slug from URL like "https://ra.co/dj/bonobo" or "/dj/bonobo"
function extractArtistSlug(url: string): string | null {
  const match = url.match(/\/dj\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function fetchRaArtist(slug: string): Promise<ArtistDetails | null> {
  if (ARTIST_CACHE.has(slug)) return ARTIST_CACHE.get(slug)!;

  try {
    const res = await fetch("https://ra.co/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://ra.co/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        query: `{
          artist(slug: "${slug}") {
            name
            image
            contentUrl
            country { name }
            biography { blurb content }
            soundcloud
            instagram
            bandcamp
            website
            followerCount
            aliases
          }
        }`,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      ARTIST_CACHE.set(slug, null);
      return null;
    }

    const data = await res.json();
    const artist = data?.data?.artist;

    if (!artist) {
      ARTIST_CACHE.set(slug, null);
      return null;
    }

    const result = buildResult(artist, slug);
    ARTIST_CACHE.set(slug, result);
    return result;
  } catch {
    ARTIST_CACHE.set(slug, null);
    return null;
  }
}

function buildResult(
  artist: {
    name?: string;
    image?: string;
    contentUrl?: string;
    country?: { name?: string };
    biography?: { blurb?: string; content?: string };
    soundcloud?: string;
    instagram?: string;
    bandcamp?: string;
    website?: string;
    followerCount?: number;
    aliases?: string;
  },
  slug: string,
): ArtistDetails {
  // Use blurb first (short), fall back to content (long bio)
  let bio = artist.biography?.blurb || artist.biography?.content || null;
  if (bio) {
    // Strip HTML tags
    bio = bio.replace(/<[^>]*>/g, "").trim();
    // Truncate at ~300 chars at a word boundary
    if (bio.length > 300) {
      bio = bio.slice(0, 300).replace(/\s+\S*$/, "") + "...";
    }
  }

  return {
    name: artist.name || slug,
    bio,
    imageUrl: artist.image || null,
    country: artist.country?.name || null,
    raUrl: artist.contentUrl ? `https://ra.co${artist.contentUrl}` : `https://ra.co/dj/${slug}`,
    soundcloudUrl: artist.soundcloud || null,
    instagramUrl: artist.instagram || null,
    bandcampUrl: artist.bandcamp || null,
    websiteUrl: artist.website || null,
    followers: artist.followerCount || null,
    aliases: artist.aliases || null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raUrl = searchParams.get("raUrl") || "";

  if (!raUrl) {
    return NextResponse.json({ error: "raUrl parameter required" }, { status: 400 });
  }

  const slug = extractArtistSlug(raUrl);
  if (!slug) {
    return NextResponse.json({ error: "Invalid RA artist URL" }, { status: 400 });
  }

  const details = await fetchRaArtist(slug);
  if (!details) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  return NextResponse.json(details);
}
