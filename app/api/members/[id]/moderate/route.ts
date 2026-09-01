import { NextRequest, NextResponse } from "next/server";
import { moderateMember } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

/** Admin-only — SC_Membership_REST::moderate_member is the real authorization boundary, this just forwards the request. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!userId) {
    return NextResponse.json({ error: "Invalid member." }, { status: 400 });
  }

  const { action } = await request.json().catch(() => ({ action: undefined }));
  if (action !== "ban" && action !== "unban") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const result = await moderateMember(token, userId, action);
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
