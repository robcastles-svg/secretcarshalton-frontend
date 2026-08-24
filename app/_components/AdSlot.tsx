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
 * Slots like the header leaderboard live in the root layout, which the App
 * Router keeps mounted across client-side <Link> navigations — without
 * `pathname` in the effect's deps, the ad picked on first load would sit
 * frozen through an entire visit instead of re-rolling on every page.
 */
export function AdSlot({
  placement,
  className,
  placeholderClassName,
  placeholderText,
}: {
  placement: string;
  className: string;
  placeholderClassName?: string;
  placeholderText?: string;
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
  }, [placement, pathname]);

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
