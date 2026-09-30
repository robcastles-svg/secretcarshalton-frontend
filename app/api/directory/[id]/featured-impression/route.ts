import { NextRequest, NextResponse } from "next/server";
import { recordFeaturedListingImpression } from "@/lib/wordpress";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  if (listingId) {
    await recordFeaturedListingImpression(listingId);
  }
  return NextResponse.json({ ok: true });
}
