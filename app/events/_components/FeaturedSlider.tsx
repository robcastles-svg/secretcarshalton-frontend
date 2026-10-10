"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import { ChevronIcon } from "./EvIcons";

/** "£5 per event" → "£5" */
const FEATURE_PRICE = EVENT_UPGRADE_PRICE.split(" ")[0];

export interface Slide {
  slug: string;
  title: string;
  image: string | null;
  weekday: string;
  day: number;
  month: string;
  place: string;
  time: string | null;
  topic: string | null;
  /** The real start instant, for the countdown. */
  targetMs: number;
}

function Tile({ s, onImage = false }: { s: Slide; onImage?: boolean }) {
  return (
    <div className={`evx-date evl-slide-date${onImage ? " evl-slide-date-img" : ""}`} aria-hidden="true">
      <span className="evx-date-w">{s.weekday}</span>
      <b>{s.day}</b>
      <span className="evx-date-m">{s.month}</span>
    </div>
  );
}

function Countdown({ targetMs, now }: { targetMs: number; now: number | null }) {
  const left = now === null ? null : Math.max(0, Math.floor((targetMs - now) / 1000));
  const v =
    left === null
      ? ["--", "--", "--", "--"]
      : [
          String(Math.floor(left / 86400)),
          String(Math.floor((left % 86400) / 3600)).padStart(2, "0"),
          String(Math.floor((left % 3600) / 60)).padStart(2, "0"),
          String(left % 60).padStart(2, "0"),
        ];
  const labels = ["days", "hrs", "min", "sec"];
  return (
    <div className="evl-cd" aria-hidden="true">
      {v.map((n, i) => (
        <div key={labels[i]} className={`evl-cd-t${i === 3 ? " evl-cd-sec" : ""}`}>
          <b>{n}</b>
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Featured events slider at the top of the list pages. Always the same
 * height (titles clamped to 3 lines) so the page never jumps; rotates
 * every 6 seconds, pauses on hover/focus, swipeable, and doesn't
 * auto-rotate for people who've asked for reduced motion. Live countdown
 * in small tiles. The date tile sits over the photo on desktop.
 */
export function FeaturedSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const paused = useRef(false);
  const startX = useRef<number | null>(null);
  const count = slides.length;
  const show = (n: number) => setIndex(((n % count) + count) % count);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % count);
    }, 6000);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <section
      className="evl-rot"
      aria-roledescription="carousel"
      aria-label="Featured events"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <div
        className="evl-rot-track"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) show(dx < 0 ? index + 1 : index - 1);
        }}
      >
        {slides.map((s, i) => (
          <Link
            key={s.slug}
            href={`/events/${s.slug}`}
            className={`evl-slide${i === index ? " evl-slide-on" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${s.title}`}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            draggable={false}
          >
            <div className="evl-s-img">
              {s.image ? <img src={s.image} alt="" draggable={false} /> : <div className="evx-card-noimg" />}
              <Tile s={s} onImage />
            </div>
            <div className="evl-s-body">
              <span className="evl-promo-pill">Featured</span>
              <div className="evl-s-top">
                <Tile s={s} />
                <div>
                  {s.topic && <div className="evl-s-cat">{s.topic}</div>}
                  <h2>{s.title}</h2>
                  <div className="evl-s-place">
                    {s.place}
                    {s.time ? ` · ${s.time}` : ""}
                  </div>
                </div>
              </div>
              <Countdown targetMs={s.targetMs} now={now} />
            </div>
          </Link>
        ))}
      </div>
      {count > 1 && (
        <div className="evl-rot-ctl">
          <button type="button" className="evl-arrow evl-arrow-prev" aria-label="Previous" onClick={() => show(index - 1)}>
            <ChevronIcon />
          </button>
          <div className="evl-dots">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => show(i)}
              />
            ))}
          </div>
          <button type="button" className="evl-arrow" aria-label="Next" onClick={() => show(index + 1)}>
            <ChevronIcon />
          </button>
        </div>
      )}
      <p className="evl-rot-sell">
        Want your event here? <Link href="/events/submit">Feature it for {FEATURE_PRICE}</Link>
      </p>
    </section>
  );
}
