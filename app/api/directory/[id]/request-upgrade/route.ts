import { NextRequest, NextResponse } from "next/server";
import { requestListingUpgrade } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Owner-gated — SC_Directory_REST::request_upgrade's ownership check is the real authorization boundary, this just forwards the request. */
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
    return NextResponse.json({ error: "No upgrade details received." }, { status: 400 });
  }

  const result = await requestListingUpgrade(token, listingId, formData);
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
