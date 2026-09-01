import { NextRequest, NextResponse } from "next/server";
import { getBookmarkState } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const contentType = request.nextUrl.searchParams.get("content_type");
  const contentId = Number(request.nextUrl.searchParams.get("content_id"));

  if ((contentType !== "post" && contentType !== "listing") || !contentId) {
    return NextResponse.json({ error: "A valid content_type and content_id are required." }, { status: 400 });
  }

  const token = await getSessionToken();
  const result = await getBookmarkState(contentType, contentId, token ?? undefined);

  if ("count" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 502 });
}
