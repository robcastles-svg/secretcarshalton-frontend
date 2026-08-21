import { NextResponse } from "next/server";
import { resendVerification } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const result = await resendVerification(token);
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
