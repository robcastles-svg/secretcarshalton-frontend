import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { uploadListingLogo } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Owner-or-admin — SC_Directory_REST::check_owns_listing is the real authorization boundary, this just forwards the request. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!listingId) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "No logo received." }, { status: 400 });
  }

  const result = await uploadListingLogo(token, listingId, formData);
  if ("logo" in result) {
    // Not a WordPress "Update", so nothing else refreshes these: the listing
    // pages and the homepage's Featured logo strip.
    revalidatePath("/directory/[slug]", "page");
    revalidatePath("/community/groups/[slug]", "page");
    revalidatePath("/");
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
