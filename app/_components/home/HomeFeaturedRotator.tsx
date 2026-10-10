"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The homepage's rotating featured-event highlight: one card at a time,
 * changing every 6 seconds, pausing on hover/focus, never auto-rotating
 * for people who've asked for reduced motion. Cards are rendered on the
 * server and passed in.
 */
export function HomeFeaturedRotator({ cards }: { cards: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (cards.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % cards.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [cards.length]);

  return (
    <div
      className="home-featured-rotator"
      aria-roledescription="carousel"
      aria-label="Featured events"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      {cards.map((card, i) => (
        <div key={i} hidden={i !== index} aria-hidden={i !== index} className="home-featured-rotator-slide">
          {card}
        </div>
      ))}
      {cards.length > 1 && (
        <div className="home-featured-rotator-dots">
          {cards.map((_, i) => (
            <button key={i} type="button" aria-label={`Show featured event ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
