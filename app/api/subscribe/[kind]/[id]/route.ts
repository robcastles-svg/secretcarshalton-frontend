import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { startSubscription } from "@/lib/wordpress";

/**
 * Starts a yearly PayPal subscription and hands back PayPal's sign-up page.
 * PayPal sends the buyer back to /payment/subscribed (which confirms it) or,
 * if they back out, to the page they started from.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { kind, id } = await params;
  if (!/^[a-z_]+$/.test(kind) || !Number(id)) return NextResponse.json({ error: "Invalid item." }, { status: 400 });

  const { from } = await request.json().catch(() => ({}));
  const origin = request.nextUrl.origin;
  const back = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
  const returnUrl = `${origin}/payment/subscribed?kind=${kind}&id=${Number(id)}`;
  const cancelUrl = `${origin}${back}`;

  const result = await startSubscription(token, kind, Number(id), returnUrl, cancelUrl);
  if ("approveUrl" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
