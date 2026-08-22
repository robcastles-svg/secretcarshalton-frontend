import { NextRequest, NextResponse } from "next/server";
import { getEventRsvpStatus, rsvpToEvent, unRsvpFromEvent } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

async function requireEventId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const eventId = Number(id);
  return eventId || null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const eventId = await requireEventId(params);
  if (!eventId) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const status = await getEventRsvpStatus(token, eventId);
  if (!status) {
    return NextResponse.json({ error: "Couldn't load RSVP status." }, { status: 502 });
  }
  return NextResponse.json(status);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const eventId = await requireEventId(params);
  if (!eventId) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const result = await rsvpToEvent(token, eventId);
  if ("going" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const eventId = await requireEventId(params);
  if (!eventId) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const result = await unRsvpFromEvent(token, eventId);
  if ("going" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
