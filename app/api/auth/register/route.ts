import { NextRequest, NextResponse } from "next/server";
import { registerMember } from "@/lib/wordpress";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, email, password } = await request.json();

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "Username, email and password are all required." },
      { status: 400 }
    );
  }

  const result = await registerMember(username, email, password);

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
