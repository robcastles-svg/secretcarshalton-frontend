import { NextRequest, NextResponse } from "next/server";
import { createDonationOrder } from "@/lib/wordpress";

/** A one-off donation; SC_Ads_Donations only accepts the amounts it offers. */
export async function POST(request: NextRequest) {
  const { amount } = await request.json().catch(() => ({ amount: 0 }));
  const result = await createDonationOrder(Number(amount));
  if ("orderId" in result) return NextResponse.json(result);
  return NextResponse.json({ error: result.message }, { status: 400 });
}
