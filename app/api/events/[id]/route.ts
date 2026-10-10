import { NextRequest, NextResponse } from "next/server";
import { deleteEvent, updateEvent } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const eventId = Number(id);
  if (!eventId) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const data = await request.json().catch(() => ({}));
  const result = await updateEvent(token, eventId, data);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}

/** Owner-only delete (moves the event to the bin) — SC_Events_REST::check_owns_event is the real boundary. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const eventId = Number((await params).id);
  if (!eventId) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const result = await deleteEvent(token, eventId);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
