import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { getMemberMe } from "@/lib/wordpress";

/**
 * Whether the visitor is logged in as a site admin, for the "Edit in
 * WordPress" button. Asked from the browser because the pages it sits on
 * are cached copies shared by every visitor, so the answer can't be baked
 * into their HTML. Visitors who aren't logged in never reach WordPress.
 */
export async function GET() {
  const token = await getSessionToken();
  const profile = token ? await getMemberMe(token) : null;
  return NextResponse.json(
    { admin: Boolean(profile?.is_admin) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
