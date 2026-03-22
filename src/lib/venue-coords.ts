// Precise venue coordinates for known electronic music venues.
// Keys are "VenueName|City" format matching the scraper output.
// These override city-level jitter with exact venue locations.

export const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  // === San Francisco ===
  "1015 Folsom|San Francisco": { lat: 37.7780411, lng: -122.4056830 },
  "F8 1192 Folsom|San Francisco": { lat: 37.7752814, lng: -122.4099546 },
  "The Midway|San Francisco": { lat: 37.7495304, lng: -122.3860944 },
  "Envelop At The Midway|San Francisco": { lat: 37.7495304, lng: -122.3860944 },
  "Cat Club|San Francisco": { lat: 37.7753288, lng: -122.4098955 },
  "Make-Out Room|San Francisco": { lat: 37.7551690, lng: -122.4195356 },
  "The Regency Ballroom|San Francisco": { lat: 37.7878176, lng: -122.4215762 },
  "Gray Area|San Francisco": { lat: 37.7508885, lng: -122.4180722 },
  "Noisebridge Hackerspace|San Francisco": { lat: 37.7623936, lng: -122.4190969 },
  "Phonobar|San Francisco": { lat: 37.7779856, lng: -122.4228597 },
  "Bar Part Time|San Francisco": { lat: 37.7681534, lng: -122.4241760 },
  "White Rabbit Bar|San Francisco": { lat: 37.7986923, lng: -122.4357083 },
  "Hedge Coffee|San Francisco": { lat: 37.7614349, lng: -122.4161263 },
  "DNA Lounge|San Francisco": { lat: 37.7710876, lng: -122.4126126 },
  "Public Works|San Francisco": { lat: 37.7688931, lng: -122.4192651 },
  "Monarch|San Francisco": { lat: 37.7809715, lng: -122.4083336 },
  "The Great Northern|San Francisco": { lat: 37.7676612, lng: -122.4065246 },
  "Audio|San Francisco": { lat: 37.7713709, lng: -122.4138077 },
  "Halcyon|San Francisco": { lat: 37.7714450, lng: -122.4139284 },
  "Mezzanine|San Francisco": { lat: 37.7825320, lng: -122.4080650 },
  "Temple|San Francisco": { lat: 37.7878851, lng: -122.3972190 },
  "Verso|San Francisco": { lat: 37.7793831, lng: -122.3981059 },
  "The Stud|San Francisco": { lat: 37.7714601, lng: -122.4143296 },
  "El Rio|San Francisco": { lat: 37.7467953, lng: -122.4194188 },
  "Jolene's|San Francisco": { lat: 37.7655970, lng: -122.4133319 },

  // === Oakland ===
  "Starline Social Club|Oakland": { lat: 37.8122821, lng: -122.2725458 },
  "New Parish|Oakland": { lat: 37.8076763, lng: -122.2725814 },
  "Fox Theater|Oakland": { lat: 37.8082481, lng: -122.2701322 },
  "Moonglow|Oakland": { lat: 37.8082904, lng: -122.2696920 },
  "Ugra Deva Loka|Oakland": { lat: 37.7815339, lng: -122.2412942 },

  // === Berkeley ===
  "Cornerstone|Berkeley": { lat: 37.8665642, lng: -122.2669287 },

  // === Santa Cruz ===
  "The Blue Lagoon|Santa Cruz": { lat: 36.9705864, lng: -122.0253571 },

  // === Sacramento ===
  "Faces Nightclub|Sacramento": { lat: 38.5754750, lng: -121.4802600 },
  "Sac Dance Lab|Sacramento": { lat: 38.5996806, lng: -121.4466974 },
  "Channel 24|Sacramento": { lat: 38.5662337, lng: -121.4789390 },
};
