"use client";

import { useEffect, useState } from "react";

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function timeRemaining(target: number): Remaining {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1_000) % 60),
  };
}

/**
 * The compact "4:01:56 Time Left" line EventON shows on every upcoming
 * event's own page — distinct from EventCountdown, which is the bigger
 * card-with-image used for the homepage/listing "Coming up next" slot.
 * Ticks client-side; renders nothing once the countdown reaches zero
 * rather than freezing at 0:00:00 (the event has started by then, not
 * "time left").
 *
 * Takes the already-parsed timestamp, not the raw meta.sc_start string —
 * WordPress's own format ("2026-10-22T19:30+0:00") isn't standard ISO
 * 8601 (that trailing "+0:00" offset, not "+00:00"), so a plain
 * `new Date(raw)` silently produces an Invalid Date in some engines. The
 * page already runs this through lib/wordpress.ts's parseEventDate for
 * the date tile and time row above; this reuses that same result rather
 * than re-parsing the raw string a second, less careful way.
 */
export function EventTimeLeft({ targetMs }: { targetMs: number }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(timeRemaining(targetMs));
    const interval = setInterval(() => setRemaining(timeRemaining(targetMs)), 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  if (!remaining) return null;
  if (remaining.days === 0 && remaining.hours === 0 && remaining.minutes === 0 && remaining.seconds === 0) {
    return null;
  }

  return (
    <p className="event-meta-row event-time-left">
      {remaining.days > 0 && <strong>{remaining.days}d </strong>}
      <strong>
        {String(remaining.hours).padStart(2, "0")}:{String(remaining.minutes).padStart(2, "0")}:
        {String(remaining.seconds).padStart(2, "0")}
      </strong>{" "}
      Time Left
    </p>
  );
}
