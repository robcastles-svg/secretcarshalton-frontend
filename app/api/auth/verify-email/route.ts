import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/lib/wordpress";
import { addToNewsletter } from "@/lib/emailoctopus";

export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({ token: undefined }));
  if (!token) {
    return NextResponse.json({ error: "No verification token provided." }, { status: 400 });
  }

  const result = await verifyEmail(token);
  if ("status" in result) {
    // Ticked the newsletter box when joining: confirming their email is the opt-in.
    if (result.newsletter && result.email) await addToNewsletter(result.email);
    return NextResponse.json({ status: result.status });
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
