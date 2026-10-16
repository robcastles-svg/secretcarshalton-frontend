import { NextRequest, NextResponse } from "next/server";
import { registerMember } from "@/lib/wordpress";
import { SESSION_COOKIE } from "@/lib/auth";
import { looksLikeSpam, SPAM_MESSAGE } from "@/lib/spam";

export async function POST(request: NextRequest) {
  const { username, email, password, newsletter, website, form_ms } = await request.json().catch(() => ({}));

  if (looksLikeSpam(website, form_ms)) {
    return NextResponse.json({ error: SPAM_MESSAGE }, { status: 400 });
  }

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "Username, email and password are all required." },
      { status: 400 }
    );
  }

  // The newsletter tick is remembered by WordPress and acted on when they confirm their email (verify-email).
  const result = await registerMember(username, email, password, newsletter === true);

  if ("token" in result) {
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: result.expires_in,
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: result.message }, { status: 400 });
}
