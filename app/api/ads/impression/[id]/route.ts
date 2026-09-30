import { NextRequest, NextResponse } from "next/server";
import { recordAdImpression } from "@/lib/wordpress";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adId = Number(id);
  if (adId) {
    await recordAdImpression(adId);
  }
  return NextResponse.json({ ok: true });
}
