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

  // NextResponse.redirect() needs an absolute URL — a relative link (most
  // house ads now use one, e.g. "/advertise", so they stay on whatever
  // domain the visitor's actually on) throws otherwise. request.url as the
  // base resolves a relative path; an already-absolute advertiser link
  // passes through unchanged.
  return NextResponse.redirect(new URL(link || "/advertise", request.url), { status: 302 });
}
