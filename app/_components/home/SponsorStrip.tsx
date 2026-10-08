"use client";

import { useEffect, useRef } from "react";

export interface Sponsor {
  id: number;
  name: string;
  /** Omitted for the placeholder tiles shown before real logo uploads exist — see the dummy array in app/page.tsx. */
  logoUrl?: string;
  href: string;
}

const AUTO_SCROLL_PX_PER_SEC = 35;
/** How long to leave the auto-scroll paused after the last user-driven scroll (drag, swipe, momentum) before resuming it. */
const RESUME_DELAY_MS = 1200;

/**
 * Auto-scrolling strip of premium-member logos, on the homepage between the lead story and More Latest.
 * A real horizontally-scrollable element (overflow-x: auto, see
 * .sponsor-strip-track) that a finger or trackpad can drag/swipe — the
 * auto-scroll itself is driven by JS incrementing scrollLeft each frame
 * rather than a CSS transform animation, specifically so it doesn't
 * fight native scroll input; it pauses on the first touch/pointer-down
 * and only resumes once scrolling has been quiet for RESUME_DELAY_MS
 * (covers touch momentum that outlasts the touchend itself). The list
 * is duplicated once so the loop (resetting scrollLeft by exactly half
 * the track's width once it's scrolled past the first copy) has no
 * visible seam, whichever way — auto or manual — it got there.
 *
 * Feeding it from real logo uploads needs the Featured-tier sign-up/edit
 * form to grow a logo-upload field first (separate follow-up) — until
 * then app/page.tsx passes a dummy placeholder array so the slider
 * itself is visible per the design handoff, with a text tile standing
 * in for each logo.
 */
export function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const pausedRef = useRef(false);
  const lastInteractionRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || sponsors.length === 0) return;

    let frame: number;
    let last = performance.now();

    function tick(now: number) {
      const dt = now - last;
      last = now;

      if (pausedRef.current && now - lastInteractionRef.current > RESUME_DELAY_MS) {
        pausedRef.current = false;
      }
      if (track && !pausedRef.current) {
        track.scrollLeft += (AUTO_SCROLL_PX_PER_SEC * dt) / 1000;
      }
      if (track) {
        const half = track.scrollWidth / 2;
        if (half > 0) {
          if (track.scrollLeft >= half) track.scrollLeft -= half;
          else if (track.scrollLeft < 0) track.scrollLeft += half;
        }
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sponsors.length]);

  if (sponsors.length === 0) return null;

  const track = [...sponsors, ...sponsors];

  function markInteraction() {
    pausedRef.current = true;
    lastInteractionRef.current = performance.now();
  }

  return (
    <div className="sponsor-strip">
      <ul
        className="sponsor-strip-track"
        ref={trackRef}
        onPointerDown={markInteraction}
        onTouchStart={markInteraction}
        onScroll={() => {
          if (pausedRef.current) lastInteractionRef.current = performance.now();
        }}
      >
        {track.map((s, i) => (
          <li key={`${s.id}-${i}`}>
            <a href={s.href} title={s.name}>
              <span className="sponsor-strip-label">Premium member</span>
              {s.logoUrl ? (
                <img src={s.logoUrl} alt={s.name} loading="lazy" />
              ) : (
                <span className="sponsor-strip-name">{s.name}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
