import { NextRequest, NextResponse } from "next/server";
import { createWalkMapOrder } from "@/lib/wordpress";

/** Anyone can buy a walk map; the price is decided by SC_Ads_Map_Sales. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const productId = Number((await params).id);
  if (!productId) return NextResponse.json({ error: "Invalid map." }, { status: 400 });
  const result = await createWalkMapOrder(productId);
  if ("orderId" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
