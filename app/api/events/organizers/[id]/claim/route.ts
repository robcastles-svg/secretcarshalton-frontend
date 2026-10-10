import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { claimOrganizer } from "@/lib/wordpress";

/** Signed-in members ask to manage an organiser; nothing changes until Rob approves it. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const organizerId = Number((await params).id);
  if (!organizerId) return NextResponse.json({ error: "Invalid organiser." }, { status: 400 });
  const { message } = await request.json().catch(() => ({ message: "" }));
  const result = await claimOrganizer(token, organizerId, String(message ?? "").slice(0, 500));
  if ("status" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
