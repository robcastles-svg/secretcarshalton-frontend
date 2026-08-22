import { NextRequest, NextResponse } from "next/server";
import { createDraftPost, getMemberMe } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const profile = await getMemberMe(token);
  if (!profile?.is_editor) {
    return NextResponse.json({ error: "Editor access required." }, { status: 403 });
  }

  const data = await request.json().catch(() => ({}));
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const content = typeof data.content === "string" ? data.content : "";
  const excerpt = typeof data.excerpt === "string" ? data.excerpt : "";

  if (!title || !content) {
    return NextResponse.json({ error: "A headline and body are required." }, { status: 400 });
  }

  const result = await createDraftPost(token, { title, content, excerpt });
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
