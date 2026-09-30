"use client";

import { useEffect, useRef } from "react";

/** Invisible — fires once when a real browser renders the card, mirrors PostViewTracker's reasoning (never counted during SSR/ISR regeneration or by a crawler). */
export function FeaturedListingImpressionTracker({ listingId }: { listingId: number }) {
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (firedFor.current === listingId) return;
    firedFor.current = listingId;
    fetch(`/api/directory/${listingId}/featured-impression`, { method: "POST" }).catch(() => {});
  }, [listingId]);

  return null;
}
