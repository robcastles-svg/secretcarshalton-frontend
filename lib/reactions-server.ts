import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { WP_STAGING_ROOT } from "@/lib/wordpress";

/**
 * Pass-through to sc-post-views' likes/shares routes (SC_Post_Reactions).
 * Adds the member's token when they're logged in, so their likes follow
 * their account, and the visitor's real IP so the plugin's per-IP hourly
 * cap applies to each visitor rather than to this server as a whole.
 */
export async function reactionsFetch(request: NextRequest, path: string, method: "GET" | "POST") {
  const headers: Record<string, string> = {};
  const token = await getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
  if (ip) headers["X-Forwarded-For"] = ip;

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    headers["Content-Type"] = "application/json";
  }

  const send = (h: Record<string, string>) =>
    fetch(`${WP_STAGING_ROOT}/sc-post-views/v1/${path}`, {
      method,
      headers: h,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

  try {
    let res = await send(headers);
    // An expired login shouldn't stop anyone liking — fall back to counting them as a visitor.
    if ((res.status === 401 || res.status === 403) && headers.Authorization) {
      const { Authorization: _drop, ...rest } = headers;
      void _drop;
      res = await send(rest);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: (data as { message?: string }).message ?? "Something went wrong." }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the site — try again." }, { status: 502 });
  }
}
