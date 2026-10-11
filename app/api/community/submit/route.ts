import { NextRequest, NextResponse } from "next/server";
import { submitCommunityPost } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { looksLikeSpam, SPAM_MESSAGE } from "@/lib/spam";

/** Owner-gated — the real authorization boundary is SC_Membership_REST::submit_community_post's is_user_logged_in() check, this just forwards the request. */
export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "No story data received." }, { status: 400 });
  }
  if (looksLikeSpam(formData.get("website"), formData.get("form_ms"))) {
    return NextResponse.json({ error: SPAM_MESSAGE }, { status: 400 });
  }
  formData.delete("website");
  formData.delete("form_ms");

  const result = await submitCommunityPost(token, formData);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
