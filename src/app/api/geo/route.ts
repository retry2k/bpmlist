import { NextRequest, NextResponse } from "next/server";

// Vercel provides geo headers automatically on deployed sites.
// This endpoint returns the client's lat/lng from those headers,
// falling back to ipapi.co for local development.
export async function GET(request: NextRequest) {
  // Vercel's edge geo headers (available on all Vercel deployments)
  const lat = request.headers.get("x-vercel-ip-latitude");
  const lng = request.headers.get("x-vercel-ip-longitude");
  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");

  if (lat && lng) {
    return NextResponse.json({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      city: city ? decodeURIComponent(city) : undefined,
      region: region || undefined,
      source: "vercel",
    });
  }

  // Fallback for local dev: use ipapi.co
  try {
    // Get the client's real IP from forwarded headers
    const forwarded = request.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : null;

    // Use the client IP if available, otherwise let ipapi detect
    const url = clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1"
      ? `https://ipapi.co/${clientIp}/json/`
      : "https://ipapi.co/json/";

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "bpmlist/1.0" },
    });
    const data = await res.json();

    if (data.latitude && data.longitude) {
      return NextResponse.json({
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
        region: data.region,
        source: "ipapi",
      });
    }
  } catch {
    // Fall through
  }

  return NextResponse.json({ error: "Could not determine location" }, { status: 404 });
}
