import { NextRequest, NextResponse } from "next/server";
import { submitListing } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const data = await request.json().catch(() => ({}));
  if (!data.title) {
    return NextResponse.json({ error: "A business/organisation name is required." }, { status: 400 });
  }

  const result = await submitListing(token, data);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
