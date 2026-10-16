import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { ownSave } from "@/lib/owner-edit";

/** Saves the member's changes to their own community post (SC_Membership_REST::update_community_post checks ownership). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  if (!formData || !/^\d+$/.test(id)) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  return ownSave(token, `sc-membership/v1/community-posts/${id}/update`, formData);
}
