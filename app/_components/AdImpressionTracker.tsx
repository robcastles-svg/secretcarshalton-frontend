"use client";

import { useEffect, useRef } from "react";

/** Invisible — fires once when a real browser renders the ad card, mirrors PostViewTracker/FeaturedListingImpressionTracker's reasoning (never counted during SSR/ISR regeneration). */
export function AdImpressionTracker({ adId }: { adId: number }) {
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (firedFor.current === adId) return;
    firedFor.current = adId;
    fetch(`/api/ads/impression/${adId}`, { method: "POST" }).catch(() => {});
  }, [adId]);

  return null;
}
