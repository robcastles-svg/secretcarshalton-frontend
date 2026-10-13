import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { getMemberMe, searchArticles } from "@/lib/wordpress";

/** Headline search for the Spotlight article picker — editors only. */
export async function GET(request: NextRequest) {
  const token = await getSessionToken();
  const profile = token ? await getMemberMe(token) : null;
  if (!profile?.is_editor) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);
  return NextResponse.json(await searchArticles(q));
}
