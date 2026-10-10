import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { captureEventFeatureOrder } from "@/lib/wordpress";

/** Owner-only capture of an approved PayPal order; on success the event is featured until its date. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const eventId = Number((await params).id);
  if (!eventId) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  if (!orderId) return NextResponse.json({ error: "No payment to confirm." }, { status: 400 });
  const result = await captureEventFeatureOrder(token, eventId, String(orderId));
  if ("status" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
