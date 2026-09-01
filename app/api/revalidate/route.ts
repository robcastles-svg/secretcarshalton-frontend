import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Every WordPress-backed page here caches its fetch()es for up to an hour
 * (see lib/wordpress.ts's REVALIDATE_SECONDS) — good for not hammering
 * staging on every request, bad when Rob wants a change to show up right
 * now instead of within the hour. This forces Next's Data Cache to refetch
 * on the next request to the given path, without waiting out the window.
 * No auth: this only ever triggers a re-fetch of already-public data, so
 * the worst case of someone spamming it is a bit of extra load on
 * staging, not a real vulnerability.
 */
export async function POST(request: NextRequest) {
  const { path } = await request.json().catch(() => ({ path: "/" }));
  const target = typeof path === "string" && path.startsWith("/") ? path : "/";
  revalidatePath(target);
  return NextResponse.json({ revalidated: true, path: target });
}
