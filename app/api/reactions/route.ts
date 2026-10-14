import { NextRequest, NextResponse } from "next/server";
import { reactionsFetch } from "@/lib/reactions-server";

/** GET ?slugs=a,b&visitor=… — counts (and whether this person liked each) for a page's worth of articles. */
export async function GET(request: NextRequest) {
  return reactionsFetch(request, `reactions${request.nextUrl.search}`, "GET");
}

export function POST() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
