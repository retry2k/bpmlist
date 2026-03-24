import { EventData, GENRE_CATEGORIES } from "@/types/event";
import { parseEventDate, isSameDay } from "@/lib/date-utils";

// Vibe-to-genre mapping: maps natural language words to genre tags
const VIBE_MAP: Record<string, string[]> = {
  // Energy levels
  dark: ["techno", "industrial", "dark techno", "hard techno", "darkwave", "ebm", "goth"],
  heavy: ["techno", "hard techno", "dubstep", "bass", "riddim", "industrial", "dnb", "drum and bass", "hardcore", "hardstyle"],
  hard: ["hard techno", "hardstyle", "hardcore", "industrial", "gabber"],
  intense: ["techno", "hard techno", "dubstep", "dnb", "drum and bass", "trance", "psytrance"],
  aggressive: ["hard techno", "industrial", "dubstep", "riddim", "hardcore"],
  chill: ["deep house", "downtempo", "ambient", "organic house", "melodic house", "lo-fi", "soulful house"],
  relaxed: ["deep house", "downtempo", "ambient", "organic house", "soulful house", "disco"],
  mellow: ["deep house", "downtempo", "ambient", "melodic house", "lo-fi"],
  smooth: ["deep house", "soulful house", "disco", "funk", "melodic house", "organic house"],
  soft: ["ambient", "downtempo", "deep house", "organic house", "melodic house"],
  calm: ["ambient", "downtempo", "deep house", "organic house"],
  easy: ["deep house", "disco", "funk", "soulful house"],
  cozy: ["deep house", "downtempo", "ambient", "lo-fi"],
  warm: ["deep house", "soulful house", "organic house", "disco", "funk"],

  // Moods
  happy: ["house", "disco", "funk", "tropical house", "dance", "edm"],
  euphoric: ["trance", "uplifting trance", "progressive trance", "melodic techno", "edm"],
  dreamy: ["trance", "ambient", "progressive trance", "melodic techno", "downtempo"],
  trippy: ["psytrance", "acid techno", "acid house", "psychedelic", "progressive trance"],
  psychedelic: ["psytrance", "acid techno", "acid house", "progressive trance"],
  melancholy: ["melodic techno", "deep house", "downtempo", "darkwave"],
  emotional: ["melodic techno", "trance", "uplifting trance", "progressive house"],
  nostalgic: ["classic trance", "disco", "synthpop", "new wave", "retro"],
  weird: ["experimental", "avant-garde", "industrial", "breakcore", "glitch"],
  funky: ["funk", "disco", "funky house", "jackin house", "nu-disco"],
  groovy: ["house", "tech house", "funky house", "disco", "funk", "jackin house"],
  bouncy: ["uk garage", "bass house", "jackin house", "speed garage"],
  energetic: ["techno", "trance", "dnb", "drum and bass", "edm", "hardstyle"],
  wild: ["hard techno", "dnb", "drum and bass", "jungle", "breakcore", "dubstep"],
  crazy: ["hard techno", "hardstyle", "hardcore", "breakcore", "dnb"],
  upbeat: ["house", "tech house", "disco", "edm", "trance"],
  sexy: ["deep house", "tech house", "minimal", "disco", "r&b"],
  underground: ["techno", "minimal techno", "deep house", "acid techno", "industrial", "dark techno"],
  mainstream: ["edm", "dance", "pop", "big room house"],
  festival: ["edm", "big room house", "trance", "dubstep", "hardstyle", "bass"],
  rave: ["techno", "hard techno", "trance", "dnb", "jungle", "hardcore", "hardstyle", "acid"],
  afterhours: ["minimal techno", "deep house", "tech house", "acid house", "dark techno"],
  late: ["techno", "minimal techno", "deep house", "dark techno", "after hours"],
  morning: ["melodic house", "progressive house", "deep house", "organic house"],
  sunset: ["melodic house", "deep house", "organic house", "balearic", "disco"],
  party: ["house", "tech house", "edm", "disco", "dance"],
  club: ["house", "techno", "tech house", "minimal", "deep house"],
  warehouse: ["techno", "industrial", "dark techno", "acid techno", "minimal techno"],
  rooftop: ["deep house", "house", "disco", "organic house", "melodic house"],
  beach: ["tropical house", "deep house", "disco", "balearic", "organic house"],
  outdoor: ["house", "techno", "trance", "progressive", "melodic house"],

  // Direct genre mentions
  techno: ["techno", "hard techno", "melodic techno", "acid techno", "minimal techno", "industrial techno", "dark techno"],
  house: ["house", "deep house", "tech house", "progressive house", "acid house", "funky house", "soulful house", "organic house"],
  trance: ["trance", "psytrance", "progressive trance", "uplifting trance", "classic trance", "tech trance"],
  bass: ["dubstep", "bass music", "riddim", "future bass", "trap", "bass house"],
  dubstep: ["dubstep", "riddim", "melodic dubstep", "tearout"],
  dnb: ["drum and bass", "drum & bass", "jungle", "liquid drum and bass", "dnb"],
  jungle: ["jungle", "drum and bass", "breakcore", "footwork"],
  disco: ["disco", "nu-disco", "disco house", "funk"],
  funk: ["funk", "disco", "funky house", "nu-disco"],
  ambient: ["ambient", "downtempo", "experimental"],
  minimal: ["minimal techno", "minimal house", "minimal"],
  progressive: ["progressive house", "progressive trance", "progressive"],
  acid: ["acid techno", "acid house", "acid trance"],
  industrial: ["industrial", "industrial techno", "ebm"],
  goth: ["goth", "darkwave", "ebm", "industrial"],
  hiphop: ["hip-hop", "trap", "rap"],
  hip: ["hip-hop", "trap", "rap"],
  rap: ["hip-hop", "trap", "rap"],
  latin: ["latin", "reggaeton", "cumbia", "latin house"],
  reggaeton: ["reggaeton", "latin"],
  afro: ["afro house", "afrobeats"],
  breaks: ["breaks", "breakbeat", "uk breaks"],
  garage: ["uk garage", "speed garage", "2-step"],
  hardcore: ["hardcore", "gabber", "hardstyle"],
  hardstyle: ["hardstyle", "hardcore"],
  electronica: ["electronica", "idm", "experimental"],
  edm: ["edm", "big room house", "dance", "electro house"],
};

// Day-of-week mapping
const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  tonight: -1, // special: today
  today: -1,
  tomorrow: -2, // special
  weekend: -3, // special: fri+sat+sun
  weeknight: -4, // special: mon-thu
};

// Venue-type keywords
const VENUE_KEYWORDS: Record<string, string[]> = {
  warehouse: ["warehouse", "industrial", "loft"],
  club: ["club", "lounge", "nightclub"],
  bar: ["bar", "pub", "tavern", "saloon"],
  outdoor: ["park", "garden", "rooftop", "beach", "patio", "outdoor", "plaza", "pier"],
  rooftop: ["rooftop", "roof"],
  beach: ["beach", "pier", "boardwalk"],
  festival: ["festival", "fairground", "grounds"],
  small: ["house", "loft", "basement", "gallery", "studio"],
  big: ["arena", "stadium", "convention", "amphitheatre", "amphitheater", "coliseum"],
  free: [], // handled by price
};

interface VibeResult {
  events: EventData[];
  response: string;
  emoji: string;
}

// Conversational response templates
const RESPONSES = {
  found: [
    "here's what i found for you",
    "i've got just the thing",
    "say less. check these out",
    "these match your energy",
    "vibes located",
    "i see you. here's what's happening",
  ],
  none: [
    "nothing quite matches that vibe right now... try switching up the mood or check another region",
    "hmm, can't find that exact vibe here. try different keywords or another city",
    "the scene's quiet for that mood right now. try something broader",
  ],
  greeting: [
    "what kind of night are you looking for?",
    "tell me the vibe you're after",
    "what mood are you in tonight?",
  ],
};

const EMOJIS: Record<string, string> = {
  dark: "🖤",
  heavy: "💀",
  hard: "⚡",
  chill: "🌊",
  relaxed: "☁️",
  smooth: "✨",
  happy: "🌞",
  euphoric: "🚀",
  trippy: "🍄",
  funky: "🕺",
  groovy: "💃",
  underground: "🔊",
  rave: "👾",
  warehouse: "🏭",
  late: "🌙",
  afterhours: "🌙",
  party: "🎉",
  beach: "🏖️",
  outdoor: "🌿",
  rooftop: "🌆",
  festival: "🎪",
  default: "🎧",
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function matchesDay(eventDate: Date, dayToken: string): boolean {
  const today = new Date();
  const mapping = DAY_MAP[dayToken];

  if (mapping === undefined) return true; // not a day token
  if (mapping === -1) return isSameDay(eventDate, today); // tonight/today
  if (mapping === -2) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return isSameDay(eventDate, tomorrow);
  }
  if (mapping === -3) {
    const dow = eventDate.getDay();
    return dow === 5 || dow === 6 || dow === 0; // fri/sat/sun
  }
  if (mapping === -4) {
    const dow = eventDate.getDay();
    return dow >= 1 && dow <= 4; // mon-thu
  }
  return eventDate.getDay() === mapping;
}

export function parseVibeQuery(input: string, events: EventData[]): VibeResult {
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return {
      events: [],
      response: pickRandom(RESPONSES.greeting),
      emoji: "👋",
    };
  }

  // Collect matched genre tags from vibe map
  const matchedTags = new Set<string>();
  let dominantVibe = "default";

  // Also check two-word combos (e.g., "deep house", "drum and bass")
  const fullInput = tokens.join(" ");

  for (const [vibe, tags] of Object.entries(VIBE_MAP)) {
    // Check if vibe word appears in tokens or as substring of input
    if (tokens.includes(vibe) || fullInput.includes(vibe)) {
      tags.forEach((t) => matchedTags.add(t));
      if (EMOJIS[vibe]) dominantVibe = vibe;
    }
  }

  // Check for day/time filters
  const dayTokens = tokens.filter((t) => DAY_MAP[t] !== undefined);
  const wantsFree = tokens.includes("free");
  const wantsAfters = tokens.some((t) => ["late", "afterhours", "afters", "after"].includes(t));

  // Check for venue type keywords
  const venueKeywords: string[] = [];
  for (const [type, keywords] of Object.entries(VENUE_KEYWORDS)) {
    if (tokens.includes(type)) {
      venueKeywords.push(...keywords);
    }
  }

  // Score and filter events
  const scored = events
    .map((event) => {
      let score = 0;
      const eventTags = event.tags.map((t) => t.toLowerCase());
      const eventTitle = event.title.toLowerCase();
      const eventVenue = event.venue.toLowerCase();

      // Genre tag matching (most important)
      if (matchedTags.size > 0) {
        let tagMatches = 0;
        for (const tag of matchedTags) {
          if (eventTags.some((et) => et.includes(tag) || tag.includes(et))) {
            tagMatches++;
          }
          // Also check title for genre keywords
          if (eventTitle.includes(tag)) {
            tagMatches += 0.5;
          }
        }
        if (tagMatches === 0) return { event, score: 0 }; // no genre match at all
        score += tagMatches * 10;
      }

      // Day matching
      if (dayTokens.length > 0) {
        const eventDate = parseEventDate(event.date);
        if (eventDate) {
          const dayMatch = dayTokens.some((dt) => matchesDay(eventDate, dt));
          if (!dayMatch) return { event, score: 0 }; // wrong day, exclude
          score += 5;
        }
      }

      // Free filter
      if (wantsFree) {
        const priceLower = event.price.toLowerCase();
        if (priceLower.includes("free") || priceLower === "$0" || priceLower === "0") {
          score += 3;
        } else {
          score -= 5;
        }
      }

      // After hours filter
      if (wantsAfters) {
        const timeMatch = event.time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const ampm = timeMatch[3].toLowerCase();
          if (ampm === "pm" && hour !== 12) hour += 12;
          if (ampm === "am" && hour === 12) hour = 0;
          if (hour >= 23 || hour <= 6) score += 5;
          else score -= 3;
        }
      }

      // Venue keyword matching
      if (venueKeywords.length > 0) {
        const venueMatch = venueKeywords.some(
          (kw) => eventVenue.includes(kw) || eventTitle.includes(kw)
        );
        if (venueMatch) score += 4;
      }

      // Title keyword matching (check if any input token appears in title)
      for (const token of tokens) {
        if (token.length > 3 && eventTitle.includes(token)) {
          score += 2;
        }
      }

      return { event, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const topEvents = scored.slice(0, 3).map((s) => s.event);
  const emoji = EMOJIS[dominantVibe] || EMOJIS.default;

  if (topEvents.length === 0) {
    // If no genre matches but we have events, try a looser search on titles
    const titleMatches = events
      .filter((e) => {
        const title = e.title.toLowerCase();
        return tokens.some((t) => t.length > 3 && title.includes(t));
      })
      .slice(0, 3);

    if (titleMatches.length > 0) {
      return {
        events: titleMatches,
        response: `found these by name — ${pickRandom(RESPONSES.found)}`,
        emoji,
      };
    }

    return {
      events: [],
      response: pickRandom(RESPONSES.none),
      emoji: "😔",
    };
  }

  return {
    events: topEvents,
    response: pickRandom(RESPONSES.found),
    emoji,
  };
}
