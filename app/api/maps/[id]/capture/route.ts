import { NextRequest, NextResponse } from "next/server";
import { captureWalkMapOrder } from "@/lib/wordpress";

/** Captures an approved PayPal order; on success returns the map's download link. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const productId = Number((await params).id);
  if (!productId) return NextResponse.json({ error: "Invalid map." }, { status: 400 });
  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  if (!orderId) return NextResponse.json({ error: "No payment to confirm." }, { status: 400 });
  const result = await captureWalkMapOrder(productId, String(orderId));
  if ("downloadUrl" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
