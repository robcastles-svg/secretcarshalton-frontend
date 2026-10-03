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
 */
export function EventTimeLeft({ startIso }: { startIso: string }) {
  const target = new Date(startIso).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(timeRemaining(target));
    const interval = setInterval(() => setRemaining(timeRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

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
