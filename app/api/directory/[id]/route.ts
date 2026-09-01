import { NextRequest, NextResponse } from "next/server";
import { updateDirectoryListing } from "@/lib/wordpress";
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

  const data = await request.json().catch(() => ({}));
  const result = await updateDirectoryListing(token, listingId, data);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
