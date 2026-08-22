import { NextRequest, NextResponse } from "next/server";
import { claimEvent } from "@/lib/wordpress";
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

  const result = await claimEvent(token, eventId);
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
