import { revalidatePath } from "next/cache";
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
    // Community groups publish straight away — show them without waiting for the cache.
    if (result.status === "publish") {
      revalidatePath("/community/groups");
      revalidatePath("/community/groups/[slug]", "page");
    }
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
