import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { proxyRoute } from "@/lib/notifications";
import { WP_STAGING_ROOT } from "@/lib/wordpress";

/**
 * One pass-through for the notification bell, email settings and Rob's
 * Member messages screens: the browser can't hold the member's token
 * (it's an httpOnly cookie), so these calls come through here and pick
 * it up server-side. Only the routes listed in lib/notifications.ts get
 * through; the plugin itself still checks who's allowed to do what
 * (editors only for /messages).
 */
async function forward(request: NextRequest, path: string[], method: "GET" | "POST") {
  const joined = path.join("/");
  const route = proxyRoute(joined, method);
  if (!route) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  if (route.auth) {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/${joined}${request.nextUrl.search}`, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Something went wrong." },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the site's database — please try again." }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path, "GET");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await params).path, "POST");
}
