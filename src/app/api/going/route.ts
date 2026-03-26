import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const count = (await kv.get<number>(`going:${eventId}`)) || 0;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId } = body;
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const count = await kv.incr(`going:${eventId}`);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
