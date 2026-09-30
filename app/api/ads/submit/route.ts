import { NextRequest, NextResponse } from "next/server";
import { submitAd } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Owner-gated — the real authorization boundary is SC_Ads_REST::submit_ad's is_user_logged_in() check, this just forwards the request. */
export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "No ad data received." }, { status: 400 });
  }

  const result = await submitAd(token, formData);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
