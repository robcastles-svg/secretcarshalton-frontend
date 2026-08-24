import { NextRequest, NextResponse } from "next/server";
import { editComment } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const data = await request.json().catch(() => ({}));
  const commentId = Number(data.commentId);
  const content = typeof data.content === "string" ? data.content.trim() : "";
  const rating = Number.isFinite(Number(data.rating)) && Number(data.rating) > 0 ? Number(data.rating) : undefined;

  if (!commentId || !content) {
    return NextResponse.json({ error: "A comment is required." }, { status: 400 });
  }

  const result = await editComment(token, commentId, content, rating);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
