/**
 * Parse artist names from 19hz event titles.
 *
 * Common patterns:
 * - "Jjko, Marie, Navii, Pap" → comma-separated artists
 * - "Fever Dream - Cole Grey, Minus Man" → dash separates event name from artists
 * - "Klub Rizz w/ Huffy" → "w/" indicates featured artist
 * - "DJ A b2b DJ B" → back-to-back
 * - "Artist1 ft. Artist2" or "feat." → featuring
 * - "Aphex Twin - Selected Ambient Works : Listen | Envelop SF" → listening event (filter out)
 */

// Words/phrases that indicate the title is NOT an artist list
const NON_ARTIST_PATTERNS = [
  /\blisten\b/i,
  /\bopen decks\b/i,
  /\bassembly\b/i,
  /\bfestival\b/i,
  /\bworkshop\b/i,
  /\bclass\b/i,
  /\blesson\b/i,
  /\bseminar\b/i,
  /\bconference\b/i,
  /\bmeeting\b/i,
  /\bcommunity\b/i,
  /\bresident\b.*\blive\b/i,
];

// Suffixes/noise to strip from artist names
const NOISE_PATTERNS = [
  /\(.*?\)/g,       // parenthetical info like "(7:30)"
  /\[.*?\]/g,       // bracketed info
  /\|.*$/,          // pipe and everything after (e.g., "| Envelop SF")
  /:\s*(listen|dance|watch)\b.*$/i, // ": Listen" events
];

export function parseArtists(title: string): string[] {
  if (!title || title.trim().length === 0) return [];

  // Skip titles that are clearly not artist listings
  for (const pattern of NON_ARTIST_PATTERNS) {
    if (pattern.test(title)) return [];
  }

  let cleaned = title;

  // Remove noise patterns
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.trim();
  if (!cleaned) return [];

  // Split on common separators to get artist names
  // Priority: if there's a " - " it often separates event_name from artists
  // But sometimes it's "Artist1 - Artist2"
  // We'll try: split by commas first, then handle b2b/w//feat within each part

  // Handle "Event Name - Artist1, Artist2" pattern
  // If there's a dash and the right side has commas, the right side is likely artists
  const dashParts = cleaned.split(/\s+-\s+/);
  if (dashParts.length === 2) {
    const rightSide = dashParts[1].trim();
    const leftSide = dashParts[0].trim();
    // If right side has commas, it's probably the artist list
    if (rightSide.includes(",")) {
      cleaned = rightSide;
    } else {
      // Both could be artists: "Artist A - Artist B"
      // Or "Event Name - Single Artist"
      // Include both as potential artists
      cleaned = `${leftSide}, ${rightSide}`;
    }
  } else if (dashParts.length > 2) {
    // Multiple dashes - just use the whole thing split by commas
    cleaned = dashParts.join(", ");
  }

  // Split on commas first
  let artists = cleaned.split(/,/).map(s => s.trim()).filter(Boolean);

  // Further split each part on "b2b", "w/", "feat.", "ft.", "vs", "x" (as separator), "&"
  const expandedArtists: string[] = [];
  for (const artist of artists) {
    const subParts = artist.split(/\s+(?:b2b|w\/|feat\.?|ft\.?|vs\.?|and)\s+/i);
    for (const part of subParts) {
      const trimmed = part.trim();
      if (trimmed && trimmed.length > 1 && trimmed.length < 60) {
        expandedArtists.push(trimmed);
      }
    }
  }

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const a of expandedArtists) {
    const key = a.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }

  // Limit to reasonable number
  return unique.slice(0, 10);
}
