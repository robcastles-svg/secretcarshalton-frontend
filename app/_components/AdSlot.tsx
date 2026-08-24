"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Ad {
  id: number;
  image: string;
  link: string;
  alt: string;
}

/**
 * Fetched client-side, not server-rendered, so the weighted-random pick
 * the sc-ads REST endpoint makes happens fresh on every pageview instead
 * of being frozen for the page's ISR revalidation window — the same
 * per-load rotation AdRotate itself did.
 *
 * Slots that live in the root layout (billboard, leaderboard) stay mounted
 * across client-side <Link> navigations, so without something forcing a
 * re-fetch, whichever ad was picked on first load would sit frozen through
 * an entire visit. `refreshOnNavigate` opts a given slot into re-rolling
 * on every route change — currently just the leaderboard; billboard/MPU
 * keep their original once-per-full-load behaviour for now.
 */
export function AdSlot({
  placement,
  className,
  placeholderClassName,
  placeholderText,
  refreshOnNavigate,
}: {
  placement: string;
  className: string;
  placeholderClassName?: string;
  placeholderText?: string;
  refreshOnNavigate?: boolean;
}) {
  const [ad, setAd] = useState<Ad | null | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads/active/${placement}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setAd(data);
      })
      .catch(() => {
        if (!cancelled) setAd(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refreshOnNavigate ? [placement, pathname] : [placement]);

  if (ad === undefined) return null;

  if (!ad) {
    if (!placeholderClassName) return null;
    return (
      <Link href="/advertising-contact" className={placeholderClassName}>
        {placeholderText || "Advertise here"}
      </Link>
    );
  }

  return (
    <a className={className} href={`/api/ads/click/${ad.id}`} target="_blank" rel="noopener sponsored">
      <img src={ad.image} alt={ad.alt} loading="lazy" />
    </a>
  );
}
