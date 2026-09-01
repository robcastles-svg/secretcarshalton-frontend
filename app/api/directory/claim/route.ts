import { NextRequest, NextResponse } from "next/server";
import { claimListing } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { listingId } = await request.json().catch(() => ({ listingId: undefined }));
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  }

  const result = await claimListing(token, listingId);
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
