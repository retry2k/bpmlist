import { REGIONS } from "@/types/event";

/**
 * Calculate distance in km between two lat/lng points using Haversine formula
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Max radius in km for each region — most cities are ~150km, larger regions get more
const REGION_RADIUS: Record<string, number> = {
  Texas: 600,
  Iowa: 500,
  BayArea: 200,
};
const DEFAULT_RADIUS = 200;

/**
 * Check if coordinates are within a reasonable distance of a region's center.
 * Returns true if the event is plausibly in the region, false if it's clearly wrong.
 */
export function isWithinRegion(
  lat: number | undefined,
  lng: number | undefined,
  regionId: string
): boolean {
  if (lat === undefined || lng === undefined) return true; // no coords = can't filter, keep it
  if (!isFinite(lat) || !isFinite(lng)) return false;

  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return true; // unknown region = keep it

  const [centerLat, centerLng] = region.center;
  const maxRadius = REGION_RADIUS[regionId] || DEFAULT_RADIUS;
  const dist = haversineKm(lat, lng, centerLat, centerLng);

  return dist <= maxRadius;
}
