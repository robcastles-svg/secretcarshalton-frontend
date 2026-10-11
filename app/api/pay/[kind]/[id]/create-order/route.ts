import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { createPaymentOrder } from "@/lib/wordpress";

/** Starts a PayPal order on the shared checkout; WordPress checks ownership and sets the price. Body may carry e.g. { tier }. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { kind, id } = await params;
  if (!/^[a-z_]+$/.test(kind) || !Number(id)) return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  const { tier } = await request.json().catch(() => ({}));
  const result = await createPaymentOrder(token, kind, Number(id), tier ? { tier: String(tier) } : {});
  if ("orderId" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
