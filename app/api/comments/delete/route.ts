import { NextRequest, NextResponse } from "next/server";
import { deleteComment } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const data = await request.json().catch(() => ({}));
  const commentId = Number(data.commentId);
  if (!commentId) {
    return NextResponse.json({ error: "Which comment?" }, { status: 400 });
  }

  const result = await deleteComment(token, commentId);
  if ("deleted" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
