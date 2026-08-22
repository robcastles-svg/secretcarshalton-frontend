import { NextRequest, NextResponse } from "next/server";
import { submitComment } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const data = await request.json().catch(() => ({}));
  const postId = Number(data.postId);
  const content = typeof data.content === "string" ? data.content.trim() : "";

  if (!postId || !content) {
    return NextResponse.json({ error: "A comment is required." }, { status: 400 });
  }

  const result = await submitComment(token, postId, content, data.parent ? Number(data.parent) : undefined);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
