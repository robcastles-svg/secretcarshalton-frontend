import { NextRequest, NextResponse } from "next/server";
import { registerMember } from "@/lib/wordpress";
import { SESSION_COOKIE } from "@/lib/auth";
import { looksLikeSpam, SPAM_MESSAGE } from "@/lib/spam";
import { addToNewsletter } from "@/lib/emailoctopus";

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

  const result = await registerMember(username, email, password);

  if ("token" in result) {
    // Ticked "Send me the Insider newsletter": EmailOctopus emails them to confirm.
    if (newsletter === true) await addToNewsletter(result.user.email);
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
