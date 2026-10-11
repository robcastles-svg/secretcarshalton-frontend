import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { capturePaymentOrder } from "@/lib/wordpress";

/** Captures the approved PayPal order; on success the item goes live straight away. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { kind, id } = await params;
  if (!/^[a-z_]+$/.test(kind) || !Number(id)) return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  if (!orderId) return NextResponse.json({ error: "No payment to confirm." }, { status: 400 });
  const result = await capturePaymentOrder(token, kind, Number(id), String(orderId));
  if ("status" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
