"use client";

import { useRef } from "react";

export interface ReelItem {
  id: string;
  thumbnailUrl: string;
  videoUrl: string;
}

const SCROLL_STEP = 220;

/**
 * 9:16 slider that bleeds off the right edge — about 6 visible on desktop
 * with prev/next arrows, 2 plus a sliver of the third on mobile,
 * swipe-only there (no arrows). Stubbed with no real items for now: the
 * Instagram feed plugin on staging (connected account, @secret.carshalton)
 * only renders via its own shortcode, no public REST API to pull clean
 * JSON from — wiring real reels up is separate follow-up work. Renders
 * nothing until `items` has content, so this is a no-op until then
 * rather than showing an empty/broken-looking slider.
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
            <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="reels-item">
              <img src={item.thumbnailUrl} alt="" loading="lazy" />
              <span className="reels-play" aria-hidden="true">
                ▶
              </span>
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
