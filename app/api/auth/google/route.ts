import { NextRequest, NextResponse } from "next/server";
import { googleSignIn } from "@/lib/wordpress";
import { setSessionCookie } from "@/lib/auth";

/**
 * "Continue with Google": the browser posts Google's ID token here. An
 * existing member (linked, or same email) is logged in straight away; a
 * new one gets back a signup token and a suggested username to confirm.
 */
export async function POST(request: NextRequest) {
  const { credential } = await request.json().catch(() => ({}));
  if (!credential || typeof credential !== "string") {
    return NextResponse.json({ error: "No Google sign-in was received." }, { status: 400 });
  }

  const result = await googleSignIn(credential);
  if ("token" in result) {
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.token, result.expires_in);
    return response;
  }
  if ("needs_username" in result) {
    return NextResponse.json({ needs_username: true, signup_token: result.signup_token, suggestion: result.suggestion });
  }
  return NextResponse.json({ error: result.message || "Google sign-in didn't work — please try again." }, { status: 400 });
}
