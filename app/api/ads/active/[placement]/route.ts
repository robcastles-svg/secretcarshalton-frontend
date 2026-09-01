import { NextRequest, NextResponse } from "next/server";
import { getAd } from "@/lib/wordpress";

export async function GET(request: NextRequest, { params }: { params: Promise<{ placement: string }> }) {
  const { placement } = await params;
  const ad = await getAd(placement);
  return NextResponse.json(ad, { headers: { "Cache-Control": "no-store" } });
}
