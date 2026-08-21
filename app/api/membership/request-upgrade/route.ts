import { NextRequest, NextResponse } from "next/server";
import { requestDirectoryUpgrade } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { listingId } = await request.json().catch(() => ({ listingId: undefined }));
  const result = await requestDirectoryUpgrade(token, listingId);

  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
