import { NextRequest, NextResponse } from "next/server";
import { getBookmarkState, getStagingPostIdForLivePost } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const contentType = request.nextUrl.searchParams.get("content_type");
  const rawContentId = Number(request.nextUrl.searchParams.get("content_id"));

  if ((contentType !== "post" && contentType !== "listing") || !rawContentId) {
    return NextResponse.json({ error: "A valid content_type and content_id are required." }, { status: 400 });
  }

  // Article cards carry the live site's post ID, but bookmarks are stored
  // on staging — translate it, see getStagingPostIdForLivePost.
  const contentId = contentType === "post" ? await getStagingPostIdForLivePost(rawContentId) : rawContentId;
  if (!contentId) {
    return NextResponse.json({ error: "Bookmarks aren't available for this article yet." }, { status: 404 });
  }

  const token = await getSessionToken();
  const result = await getBookmarkState(contentType, contentId, token ?? undefined);

  if ("count" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 502 });
}
