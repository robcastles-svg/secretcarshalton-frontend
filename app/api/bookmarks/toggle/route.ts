import { NextRequest, NextResponse } from "next/server";
import { toggleBookmark } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const data = await request.json().catch(() => ({}));
  const contentType = data.contentType;
  const contentId = Number(data.contentId);

  if ((contentType !== "post" && contentType !== "listing") || !contentId) {
    return NextResponse.json({ error: "A valid contentType and contentId are required." }, { status: 400 });
  }

  const result = await toggleBookmark(token, contentType, contentId);
  if ("bookmarked" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
