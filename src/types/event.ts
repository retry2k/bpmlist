export interface EventData {
  id: string;
  date: string;
  time: string;
  title: string;
  venue: string;
  city: string;
  eventUrl: string;
  tags: string[];
  price: string;
  age: string;
  organizers: string;
  links: { label: string; url: string }[];
  address?: string;
  lat?: number;
  lng?: number;
  source?: "19hz" | "ticketmaster" | "ra";
}

export interface Region {
  id: string;
  name: string;
  slug: string;
  center: [number, number];
  zoom: number;
  state: string; // State/province for geocoding context
  has19hz?: boolean; // true if 19hz covers this region (default true for existing regions)
}

export const REGIONS: Region[] = [
  // 19hz regions (have both 19hz + Ticketmaster data)
  { id: "BayArea", name: "San Francisco Bay Area", slug: "bay-area", center: [37.8, -122.2], zoom: 9, state: "California", has19hz: true },
  { id: "LosAngeles", name: "Los Angeles", slug: "los-angeles", center: [34.0522, -118.2437], zoom: 11, state: "California", has19hz: true },
  { id: "Seattle", name: "Seattle", slug: "seattle", center: [47.6062, -122.3321], zoom: 11, state: "Washington", has19hz: true },
  { id: "Atlanta", name: "Atlanta", slug: "atlanta", center: [33.749, -84.388], zoom: 11, state: "Georgia", has19hz: true },
  { id: "Miami", name: "Miami", slug: "miami", center: [25.7617, -80.1918], zoom: 11, state: "Florida", has19hz: true },
  { id: "DC", name: "Washington DC", slug: "dc", center: [38.9072, -77.0369], zoom: 11, state: "Washington DC", has19hz: true },
  { id: "Toronto", name: "Toronto", slug: "toronto", center: [43.6532, -79.3832], zoom: 11, state: "Ontario, Canada", has19hz: true },
  { id: "Iowa", name: "Iowa / Nebraska", slug: "iowa", center: [41.8781, -93.0977], zoom: 7, state: "Iowa", has19hz: true },
  { id: "Texas", name: "Texas", slug: "texas", center: [31.9686, -99.9018], zoom: 6, state: "Texas", has19hz: true },
  { id: "Denver", name: "Denver", slug: "denver", center: [39.7392, -104.9903], zoom: 11, state: "Colorado", has19hz: true },
  { id: "CHI", name: "Chicago", slug: "chicago", center: [41.8781, -87.6298], zoom: 11, state: "Illinois", has19hz: true },
  { id: "Detroit", name: "Detroit", slug: "detroit", center: [42.3314, -83.0458], zoom: 11, state: "Michigan", has19hz: true },
  { id: "Massachusetts", name: "Massachusetts", slug: "massachusetts", center: [42.3601, -71.0589], zoom: 10, state: "Massachusetts", has19hz: true },
  { id: "LasVegas", name: "Las Vegas", slug: "las-vegas", center: [36.1699, -115.1398], zoom: 11, state: "Nevada", has19hz: true },
  { id: "Phoenix", name: "Phoenix", slug: "phoenix", center: [33.4484, -112.074], zoom: 11, state: "Arizona", has19hz: true },
  { id: "ORE", name: "Portland / Oregon", slug: "portland", center: [45.5152, -122.6784], zoom: 11, state: "Oregon", has19hz: true },
  { id: "BC", name: "Vancouver / BC", slug: "vancouver", center: [49.2827, -123.1207], zoom: 11, state: "British Columbia, Canada", has19hz: true },
  // Ticketmaster-only regions
  { id: "NYC", name: "New York City", slug: "nyc", center: [40.7128, -74.006], zoom: 11, state: "New York" },
  { id: "Philadelphia", name: "Philadelphia", slug: "philadelphia", center: [39.9526, -75.1652], zoom: 11, state: "Pennsylvania" },
  { id: "Minneapolis", name: "Minneapolis", slug: "minneapolis", center: [44.9778, -93.265], zoom: 11, state: "Minnesota" },
  { id: "Nashville", name: "Nashville", slug: "nashville", center: [36.1627, -86.7816], zoom: 11, state: "Tennessee" },
  { id: "NewOrleans", name: "New Orleans", slug: "new-orleans", center: [29.9511, -90.0715], zoom: 11, state: "Louisiana" },
  { id: "SanDiego", name: "San Diego", slug: "san-diego", center: [32.7157, -117.1611], zoom: 11, state: "California" },
  { id: "Orlando", name: "Orlando", slug: "orlando", center: [28.5383, -81.3792], zoom: 11, state: "Florida" },
  { id: "Charlotte", name: "Charlotte", slug: "charlotte", center: [35.2271, -80.8431], zoom: 11, state: "North Carolina" },
  { id: "Pittsburgh", name: "Pittsburgh", slug: "pittsburgh", center: [40.4406, -79.9959], zoom: 11, state: "Pennsylvania" },
  { id: "Montreal", name: "Montreal", slug: "montreal", center: [45.5017, -73.5673], zoom: 11, state: "Quebec, Canada" },
];

// Top 5 genre groups for quick filter buttons
export const GENRE_CATEGORIES: Record<string, string[]> = {
  house: ["house", "deep house", "tech house", "progressive house", "acid house", "minimal house", "afro house", "funky house", "latin house", "soulful house", "organic house", "chicago house", "jackin house", "disco house", "circuit house", "electro house", "big room house", "hard house", "bass house", "melodic house", "tropical house", "tribal house", "french house"],
  techno: ["techno", "hard techno", "melodic techno", "acid techno", "minimal techno", "industrial techno", "big room techno", "dark techno"],
  bass: ["dubstep", "bass music", "bass", "riddim", "future bass", "melodic dubstep", "trap", "hybrid trap", "uk bass", "speed bass", "tearout", "drumstep"],
  trance: ["trance", "psytrance", "progressive trance", "uplifting trance", "classic trance", "hard trance", "tech trance", "neo trance", "acid trance"],
  dnb: ["drum and bass", "drum & bass", "jungle", "liquid drum and bass", "footwork", "juke", "breakcore"],
};

// Top 15 genre tags by popularity from 19hz (excluding tags already covered by quick filters)
// These appear in the "+" dropdown for more specific filtering
export const DROPDOWN_GENRE_TAGS: string[] = [
  "edm",
  "synthpop",
  "hip-hop",
  "industrial",
  "goth",
  "uk garage",
  "darkwave",
  "ebm",
  "disco",
  "breaks",
  "hardcore",
  "hardstyle",
  "indie dance",
  "new wave",
  "downtempo",
];
