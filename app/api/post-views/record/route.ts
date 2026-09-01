import { NextRequest, NextResponse } from "next/server";
import { recordPostView } from "@/lib/wordpress";

/**
 * Client-side (PostViewTracker) posts here rather than straight to
 * WP_STAGING_ROOT — keeps that URL server-side only, same as every other
 * mutation in this app (comments, RSVPs, ad clicks).
 */
export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({}));
  const postId = Number(data.postId);
  const slug = typeof data.slug === "string" ? data.slug : "";
  const title = typeof data.title === "string" ? data.title : "";

  if (!postId) {
    return NextResponse.json({ error: "A postId is required." }, { status: 400 });
  }

  await recordPostView(postId, slug, title);
  return NextResponse.json({ status: "recorded" });
}
