"use client";

import { useEffect, useRef } from "react";
import type { WPAd } from "@/lib/wordpress";

/**
 * Compact horizontal layout (square image left, text right) — deliberately
 * smaller than a pink featured-listing card, so a blue ad never reads as
 * prominent as a paid-featured member's card in the same grid/sidebar.
 *
 * A client component so it can track real viewport visibility, not just
 * "rendered in the DOM": a sidebar ad sitting below the fold (especially
 * on mobile, where the sidebar commonly moves below the main content)
 * shouldn't count as a view just because the page loaded. Fires once,
 * the first time at least half the card is actually on screen — the IAB
 * "viewable impression" bar, not a plain page-load count.
 */
export function AdCard({ ad, className }: { ad: WPAd; className?: string }) {
  const ref = useRef<HTMLLIElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          fetch(`/api/ads/impression/${ad.id}`, { method: "POST" }).catch(() => {});
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id]);

  // Falls back to the ad's own alt text when there's no headline — real,
  // already-authored data (set when the ad was created), not invented
  // copy — so an older image-only ad (set up directly in wp-admin, before
  // the self-serve form required a headline) still shows something
  // readable instead of just a badge and a gap.
  const title = ad.headline || ad.alt;

  return (
    <li className={`ad-card-external${className ? ` ${className}` : ""}`} ref={ref}>
      <a href={`/api/ads/click/${ad.id}`} target="_blank" rel="noopener sponsored" className="ad-card-row">
        {ad.image && <img src={ad.image} alt={ad.alt} loading="lazy" />}
        <div className="card-text">
          <span className="ad-card-badge">Advertisement</span>
          {title && <span className="card-title">{title}</span>}
          {ad.body && <p className="ad-card-body">{ad.body}</p>}
        </div>
      </a>
    </li>
  );
}
