import { NextRequest, NextResponse } from "next/server";
import { getMemberMe, updateDirectoryListing } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Admin/editor-only for now — see the "Edit listing" button's is_editor gate on the listing page. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const profile = await getMemberMe(token);
  if (!profile?.is_editor) {
    return NextResponse.json({ error: "You don't have permission to edit this listing." }, { status: 403 });
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
