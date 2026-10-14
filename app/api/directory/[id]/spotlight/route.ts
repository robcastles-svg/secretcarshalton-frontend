import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/lib/auth";
import { WP_STAGING_ROOT } from "@/lib/wordpress";

/** Saves a listing's Spotlight articles. The plugin only lets editors do this. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const listingId = Number((await params).id);
  const { slugs } = await request.json().catch(() => ({ slugs: null }));
  if (!listingId || !Array.isArray(slugs)) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/${listingId}/spotlight`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: body.message ?? "Couldn't save." }, { status: res.status });
    refreshListingPages();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the site's database — please try again." }, { status: 502 });
  }
}

/**
 * These saves don't go through WordPress's own "Update", so the
 * sc-revalidate plugin never hears about them — refresh every listing page
 * (and its edit page) now rather than waiting out the hour-long cache.
 */
function refreshListingPages() {
  revalidatePath("/directory/[slug]", "page");
  revalidatePath("/directory/[slug]/edit", "page");
  revalidatePath("/community/groups/[slug]", "page");
}
