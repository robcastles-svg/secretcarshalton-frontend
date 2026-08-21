import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/lib/wordpress";

export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({ token: undefined }));
  if (!token) {
    return NextResponse.json({ error: "No verification token provided." }, { status: 400 });
  }

  const result = await verifyEmail(token);
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
