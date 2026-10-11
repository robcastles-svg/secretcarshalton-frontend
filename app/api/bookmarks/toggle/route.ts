import { NextRequest, NextResponse } from "next/server";
import { getStagingPostIdForLivePost, toggleBookmark } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const data = await request.json().catch(() => ({}));
  const contentType = data.contentType;
  const rawContentId = Number(data.contentId);

  if ((contentType !== "post" && contentType !== "listing") || !rawContentId) {
    return NextResponse.json({ error: "A valid contentType and contentId are required." }, { status: 400 });
  }

  // Article cards carry the live site's post ID, but bookmarks are stored
  // on staging — translate it, see getStagingPostIdForLivePost.
  const contentId = contentType === "post" ? await getStagingPostIdForLivePost(rawContentId) : rawContentId;
  if (!contentId) {
    return NextResponse.json({ error: "Bookmarks aren't available for this article yet." }, { status: 400 });
  }

  const result = await toggleBookmark(token, contentType, contentId);
  if ("bookmarked" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
