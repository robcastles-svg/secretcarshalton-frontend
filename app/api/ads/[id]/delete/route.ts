import { NextRequest, NextResponse } from "next/server";
import { deleteAd } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Owner-gated — SC_Ads_REST::check_owns_ad is the real authorization boundary, this just forwards the request. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const adId = Number(id);
  if (!adId) {
    return NextResponse.json({ error: "Invalid ad." }, { status: 400 });
  }

  const result = await deleteAd(token, adId);
  if ("deleted" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
