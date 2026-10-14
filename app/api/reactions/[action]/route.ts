import { NextRequest, NextResponse } from "next/server";
import { reactionsFetch } from "@/lib/reactions-server";

/** POST /api/reactions/like {slug, visitor, liked} or /api/reactions/share {slug}. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "like" && action !== "share") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return reactionsFetch(request, `reactions/${action}`, "POST");
}
