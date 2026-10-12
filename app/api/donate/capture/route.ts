import { NextRequest, NextResponse } from "next/server";
import { captureDonationOrder } from "@/lib/wordpress";

export async function POST(request: NextRequest) {
  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  if (!orderId) return NextResponse.json({ error: "No payment to confirm." }, { status: 400 });
  const result = await captureDonationOrder(String(orderId));
  if ("status" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
