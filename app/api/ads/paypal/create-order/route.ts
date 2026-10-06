import { NextRequest, NextResponse } from "next/server";
import { createAdPayPalOrder } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Owner-gated — SC_Ads_PayPal_REST::check_owns_ad_from_param is the real authorization boundary, this just forwards the request. */
export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { adId } = await request.json().catch(() => ({ adId: undefined }));
  const id = Number(adId);
  if (!id) {
    return NextResponse.json({ error: "Invalid ad." }, { status: 400 });
  }

  const result = await createAdPayPalOrder(token, id);
  if ("orderId" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
