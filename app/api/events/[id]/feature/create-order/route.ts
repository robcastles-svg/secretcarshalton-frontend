import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { createEventFeatureOrder } from "@/lib/wordpress";

/** Owner-only — SC_Events_REST::check_owns_event is the real boundary, and the price is set server-side. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const eventId = Number((await params).id);
  if (!eventId) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const result = await createEventFeatureOrder(token, eventId);
  if ("orderId" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
