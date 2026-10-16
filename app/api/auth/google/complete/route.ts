import { NextRequest, NextResponse } from "next/server";
import { googleComplete } from "@/lib/wordpress";
import { setSessionCookie } from "@/lib/auth";
import { addToNewsletter } from "@/lib/emailoctopus";

/** A new Google member's chosen username: creates the account and logs them in. */
export async function POST(request: NextRequest) {
  const { signup_token, username, newsletter } = await request.json().catch(() => ({}));
  if (!signup_token || !username) {
    return NextResponse.json({ error: "Please choose a username." }, { status: 400 });
  }

  const result = await googleComplete(String(signup_token), String(username));
  if ("token" in result) {
    if (newsletter === true && result.created) await addToNewsletter(result.user.email, "pending");
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.token, result.expires_in);
    return response;
  }
  return NextResponse.json({ error: result.message || "Couldn't create your account — please try again." }, { status: 400 });
}
