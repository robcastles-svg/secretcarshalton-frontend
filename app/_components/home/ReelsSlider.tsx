"use client";

import { useRef } from "react";

export interface ReelItem {
  id: string;
  thumbnailUrl: string;
  /** The post on Instagram (or the profile, if its own link couldn't be read). */
  videoUrl: string;
  caption?: string;
  /** Reels and videos get the play badge; photos don't. */
  isVideo?: boolean;
}

const SCROLL_STEP = 220;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * 4:5 slider that bleeds off the right edge — about 5 visible on desktop
 * with prev/next arrows, 2 plus a sliver of the third on mobile,
 * swipe-only there (no arrows). Items come from the Instagram feed
 * WordPress already has (see lib/instagram.ts). Renders nothing when
 * `items` is empty, rather than an empty/broken-looking slider.
 */
export function ReelsSlider({ items }: { items: ReelItem[] }) {
  const trackRef = useRef<HTMLUListElement>(null);

  if (items.length === 0) return null;

  function scrollBy(amount: number) {
    trackRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="reels-slider">
      <ul className="reels-track" ref={trackRef}>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="reels-item"
              title={item.caption ? truncate(item.caption, 120) : undefined}
            >
              <img src={item.thumbnailUrl} alt={item.caption ? truncate(item.caption, 120) : "Instagram post"} loading="lazy" />
              {item.isVideo && (
                <span className="reels-play" aria-hidden="true">
                  ▶
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="reels-arrow reels-arrow-prev" onClick={() => scrollBy(-SCROLL_STEP)} aria-label="Previous">
        ‹
      </button>
      <button type="button" className="reels-arrow reels-arrow-next" onClick={() => scrollBy(SCROLL_STEP)} aria-label="Next">
        ›
      </button>
    </div>
  );
}
