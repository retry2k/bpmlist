#!/usr/bin/env node
// One-time script to geocode all venues from all 19hz regions
// Outputs venue coordinates to paste into venue-coords.ts

import * as cheerio from "cheerio";
import { readFileSync } from "fs";

const REGIONS = [
  { id: "BayArea", state: "California", center: [37.8, -122.2] },
  { id: "LosAngeles", state: "California", center: [34.0522, -118.2437] },
  { id: "Seattle", state: "Washington", center: [47.6062, -122.3321] },
  { id: "Atlanta", state: "Georgia", center: [33.749, -84.388] },
  { id: "Miami", state: "Florida", center: [25.7617, -80.1918] },
  { id: "DC", state: "Washington DC", center: [38.9072, -77.0369] },
  { id: "Toronto", state: "Ontario, Canada", center: [43.6532, -79.3832] },
  { id: "Iowa", state: "Iowa", center: [41.8781, -93.0977] },
  { id: "Texas", state: "Texas", center: [31.9686, -99.9018] },
  { id: "Denver", state: "Colorado", center: [39.7392, -104.9903] },
  { id: "CHI", state: "Illinois", center: [41.8781, -87.6298] },
  { id: "Detroit", state: "Michigan", center: [42.3314, -83.0458] },
  { id: "Massachusetts", state: "Massachusetts", center: [42.3601, -71.0589] },
  { id: "LasVegas", state: "Nevada", center: [36.1699, -115.1398] },
  { id: "Phoenix", state: "Arizona", center: [33.4484, -112.074] },
  { id: "ORE", state: "Oregon", center: [45.5152, -122.6784] },
  { id: "BC", state: "British Columbia, Canada", center: [49.2827, -123.1207] },
];

// Load existing venue coords to skip already-known venues
let existingVenues = new Set();
try {
  const venueFile = readFileSync(new URL("../src/lib/venue-coords.ts", import.meta.url), "utf-8");
  const matches = venueFile.matchAll(/"([^"]+\|[^"]+)":/g);
  for (const m of matches) {
    existingVenues.add(m[1]);
  }
  console.log(`Loaded ${existingVenues.size} existing venue entries`);
} catch (e) {
  console.log("No existing venue-coords.ts found, starting fresh");
}

function parseVenues(html) {
  const $ = cheerio.load(html);
  const venues = new Map(); // key -> { venue, city }

  $("table tbody tr").each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 6) return;

    const titleCell = $(cells[1]);
    const fullText = titleCell.text().trim();
    const atMatch = fullText.match(/@\s*(.+)/);
    if (!atMatch) return;

    let venue = "";
    let city = "";
    const venueAndCity = atMatch[1].trim();
    const cityMatch = venueAndCity.match(/\(([^)]+)\)\s*$/);
    if (cityMatch) {
      city = cityMatch[1].trim();
      venue = venueAndCity.replace(/\([^)]+\)\s*$/, "").trim();
    } else {
      venue = venueAndCity;
    }

    if (venue && city) {
      const key = `${venue}|${city}`;
      if (!venues.has(key)) {
        venues.set(key, { venue, city });
      }
    }
  });

  return venues;
}

async function geocodeVenue(venueName, city, state, regionCenter) {
  // Try venue + city + state first
  const queries = [
    `${venueName}, ${city}, ${state}`,
    `${venueName}, ${city}`,
  ];

  for (const query of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "bpmlist-geocoder/1.0 (one-time venue geocoding)" },
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      if (data && data.length > 0) {
        // Pick result closest to region center
        let best = null;
        let bestDist = Infinity;
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const dlat = lat - regionCenter[0];
          const dlng = lng - regionCenter[1];
          const dist = Math.sqrt(dlat * dlat + dlng * dlng);
          if (dist < bestDist) {
            bestDist = dist;
            const parts = (item.display_name || "").split(",").map(s => s.trim());
            const address = parts.slice(0, 3).join(", ");
            best = { lat, lng, address, dist };
          }
        }
        // Accept if within ~200km of region center (~2 degrees)
        if (best && best.dist < 2.0) {
          return best;
        }
      }
    } catch (e) {
      // skip this query
    }
    // Rate limit between queries
    await sleep(1100);
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const allVenues = new Map(); // venueKey -> { venue, city, regionId, state, center }

  // Step 1: Fetch all regions and collect unique venues
  console.log("=== Step 1: Fetching all regions ===\n");

  for (const region of REGIONS) {
    console.log(`Fetching ${region.id}...`);
    try {
      const res = await fetch(`https://19hz.info/eventlisting_${region.id}.php`, {
        headers: { "User-Agent": "bpmlist-geocoder/1.0" },
      });
      const html = await res.text();
      const venues = parseVenues(html);

      let newCount = 0;
      for (const [key, data] of venues) {
        if (!existingVenues.has(key) && !allVenues.has(key)) {
          allVenues.set(key, { ...data, regionId: region.id, state: region.state, center: region.center });
          newCount++;
        }
      }
      console.log(`  Found ${venues.size} venues, ${newCount} new`);
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
    await sleep(500);
  }

  console.log(`\n=== Step 2: Geocoding ${allVenues.size} venues ===\n`);

  const results = new Map(); // regionId -> [{ key, lat, lng, address }]
  let geocoded = 0;
  let failed = 0;
  let total = allVenues.size;

  for (const [key, data] of allVenues) {
    geocoded++;
    process.stdout.write(`[${geocoded}/${total}] ${key}... `);

    const result = await geocodeVenue(data.venue, data.city, data.state, data.center);

    if (result) {
      if (!results.has(data.regionId)) results.set(data.regionId, []);
      results.get(data.regionId).push({
        key,
        lat: result.lat,
        lng: result.lng,
        address: result.address,
      });
      console.log(`✓ ${result.address}`);
    } else {
      failed++;
      console.log(`✗ not found`);
    }

    await sleep(1100); // Nominatim rate limit
  }

  console.log(`\n=== Results: ${geocoded - failed} found, ${failed} not found ===\n`);

  // Output as TypeScript
  console.log("// === PASTE INTO venue-coords.ts ===\n");
  for (const [regionId, venues] of results) {
    console.log(`  // === ${regionId} (auto-geocoded) ===`);
    for (const v of venues) {
      const addr = v.address.replace(/"/g, '\\"');
      console.log(`  "${v.key}": { lat: ${v.lat.toFixed(7)}, lng: ${v.lng.toFixed(7)}, address: "${addr}" },`);
    }
    console.log();
  }
}

main().catch(console.error);
