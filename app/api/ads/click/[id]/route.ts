import { NextRequest, NextResponse } from "next/server";
import { recordAdClick } from "@/lib/wordpress";

/**
 * A trackable redirect — the ad image links here, not straight at the
 * advertiser, so a click gets counted before the visitor leaves. Mirrors
 * the "gofollow" tracking link AdRotate itself wrapped every ad in.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adId = Number(id);
  const link = adId ? await recordAdClick(adId) : null;

  return NextResponse.redirect(link || "/advertising-contact", { status: 302 });
}
