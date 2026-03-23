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
}

export interface Region {
  id: string;
  name: string;
  slug: string;
  center: [number, number];
  zoom: number;
  state: string; // State/province for geocoding context
}

export const REGIONS: Region[] = [
  { id: "BayArea", name: "San Francisco Bay Area", slug: "bay-area", center: [37.8, -122.2], zoom: 9, state: "California" },
  { id: "LosAngeles", name: "Los Angeles", slug: "los-angeles", center: [34.0522, -118.2437], zoom: 11, state: "California" },
  { id: "Seattle", name: "Seattle", slug: "seattle", center: [47.6062, -122.3321], zoom: 11, state: "Washington" },
  { id: "Atlanta", name: "Atlanta", slug: "atlanta", center: [33.749, -84.388], zoom: 11, state: "Georgia" },
  { id: "Miami", name: "Miami", slug: "miami", center: [25.7617, -80.1918], zoom: 11, state: "Florida" },
  { id: "DC", name: "Washington DC", slug: "dc", center: [38.9072, -77.0369], zoom: 11, state: "Washington DC" },
  { id: "Toronto", name: "Toronto", slug: "toronto", center: [43.6532, -79.3832], zoom: 11, state: "Ontario, Canada" },
  { id: "Iowa", name: "Iowa / Nebraska", slug: "iowa", center: [41.8781, -93.0977], zoom: 7, state: "Iowa" },
  { id: "Texas", name: "Texas", slug: "texas", center: [31.9686, -99.9018], zoom: 6, state: "Texas" },
  { id: "Denver", name: "Denver", slug: "denver", center: [39.7392, -104.9903], zoom: 11, state: "Colorado" },
  { id: "CHI", name: "Chicago", slug: "chicago", center: [41.8781, -87.6298], zoom: 11, state: "Illinois" },
  { id: "Detroit", name: "Detroit", slug: "detroit", center: [42.3314, -83.0458], zoom: 11, state: "Michigan" },
  { id: "Massachusetts", name: "Massachusetts", slug: "massachusetts", center: [42.3601, -71.0589], zoom: 10, state: "Massachusetts" },
  { id: "LasVegas", name: "Las Vegas", slug: "las-vegas", center: [36.1699, -115.1398], zoom: 11, state: "Nevada" },
  { id: "Phoenix", name: "Phoenix", slug: "phoenix", center: [33.4484, -112.074], zoom: 11, state: "Arizona" },
  { id: "ORE", name: "Portland / Oregon", slug: "portland", center: [45.5152, -122.6784], zoom: 11, state: "Oregon" },
  { id: "BC", name: "Vancouver / BC", slug: "vancouver", center: [49.2827, -123.1207], zoom: 11, state: "British Columbia, Canada" },
];

export const GENRE_CATEGORIES: Record<string, string[]> = {
  house: ["house", "deep house", "tech house", "progressive house", "acid house", "minimal house", "afro house", "playa tech"],
  techno: ["techno", "industrial techno", "acid techno", "minimal techno", "hard techno"],
  dnb: ["drum and bass", "dnb", "drum & bass", "jungle", "liquid dnb"],
  other: [],
};
