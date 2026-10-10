import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { uploadEventImages } from "@/lib/wordpress";

/** The event's photo and/or organiser logo. Owner-only — SC_Events_REST::check_owns_event is the real boundary; this just forwards. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const eventId = Number((await params).id);
  if (!eventId) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  const result = await uploadEventImages(token, eventId, formData);
  if ("code" in result) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json(result);
}
