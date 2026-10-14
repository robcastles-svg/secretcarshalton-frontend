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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Edge-to-edge strip of 9:16 thumbnails, like reels (Rob, 2026-10): the
 * first sits right against the left edge of the screen, with four and a
 * half across on desktop (two and a half on a phone) so it's clear there's
 * more. No arrows — drag it sideways with the mouse, or swipe on a phone.
 * Items come from the Instagram feed WordPress already has (see
 * lib/instagram.ts); renders nothing when `items` is empty.
 */
export function ReelsSlider({ items }: { items: ReelItem[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  if (items.length === 0) return null;

  // Mouse drag only — touch already scrolls the strip natively.
  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !trackRef.current) return;
    drag.current = { down: true, startX: e.clientX, startLeft: trackRef.current.scrollLeft, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d.down || !track) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      track.classList.add("is-dragging");
      track.setPointerCapture(e.pointerId);
    }
    if (d.moved) track.scrollLeft = d.startLeft - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    drag.current.down = false;
    if (track?.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
    track?.classList.remove("is-dragging");
  };

  // A drag shouldn't also open the reel it started on.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div className="reels-slider">
      <ul
        className="reels-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="reels-item"
              draggable={false}
              title={item.caption ? truncate(item.caption, 120) : undefined}
            >
              <img
                src={item.thumbnailUrl}
                alt={item.caption ? truncate(item.caption, 120) : "Instagram post"}
                loading="lazy"
                draggable={false}
              />
              {item.isVideo && (
                <span className="reels-play" aria-hidden="true">
                  ▶
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
