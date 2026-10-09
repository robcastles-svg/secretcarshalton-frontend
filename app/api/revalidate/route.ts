import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Every WordPress-backed page here caches its fetch()es for up to an hour
 * (see lib/wordpress.ts's REVALIDATE_SECONDS) — good for not hammering
 * WordPress on every request, bad when Rob wants a change to show up right
 * now. This forces Next's cache to refetch on the next request instead of
 * waiting out the window.
 *
 * Called automatically by the sc-revalidate WordPress plugin whenever
 * content is published/updated/deleted there, with { all: true } — a whole
 * site refresh, since one post can appear on many pages (homepage, its
 * section, themes, search…) and working out exactly which is fragile.
 * { path: "/x" } still refreshes a single page for manual use.
 *
 * When REVALIDATE_SECRET is set, requests must send it in the
 * x-revalidate-secret header (the plugin's settings page holds the same
 * value); without it, the route stays open as before.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.all === true) {
    revalidatePath("/", "layout");
    return NextResponse.json({ revalidated: true, all: true });
  }

  const target = typeof body?.path === "string" && body.path.startsWith("/") ? body.path : "/";
  revalidatePath(target);
  return NextResponse.json({ revalidated: true, path: target });
}
