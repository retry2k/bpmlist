import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

// When a user reports a wrong venue location, clear it from KV cache
// so it gets re-geocoded on the next request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { venue, city } = body;
    if (!venue || !city) {
      return NextResponse.json({ error: "venue and city required" }, { status: 400 });
    }

    const key = `venue:${venue}|${city}`;
    await kv.del(key);

    return NextResponse.json({ cleared: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
