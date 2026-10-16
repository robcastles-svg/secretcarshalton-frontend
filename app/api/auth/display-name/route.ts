import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/lib/auth";
import { updateDisplayName } from "@/lib/wordpress";

/** Changes the logged-in member's public name (dashboard). */
export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { display_name } = await request.json().catch(() => ({}));
  const result = await updateDisplayName(token, String(display_name ?? ""));
  if ("display_name" in result) {
    // Their name shows on cached pages (comments, members list): refresh them.
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
