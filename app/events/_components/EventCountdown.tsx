"use client";

import Link from "next/link";
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

/** Matches EventON's live "Coming up Next in ___" countdown — ticks client-side. */
export function EventCountdown({
  title,
  slug,
  startIso,
  venueName,
}: {
  title: string;
  slug: string;
  startIso: string;
  venueName?: string;
}) {
  const target = new Date(startIso).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(timeRemaining(target));
    const interval = setInterval(() => setRemaining(timeRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <Link href={`/events/${slug}`} className="event-countdown">
      <span className="event-countdown-label">Coming up next</span>
      {remaining && (
        <span className="event-countdown-timer">
          <span>
            <strong>{remaining.days}</strong> {remaining.days === 1 ? "day" : "days"}
          </span>
          <span>
            <strong>{String(remaining.hours).padStart(2, "0")}</strong>hrs
          </span>
          <span>
            <strong>{String(remaining.minutes).padStart(2, "0")}</strong>min
          </span>
          <span>
            <strong>{String(remaining.seconds).padStart(2, "0")}</strong>sec
          </span>
        </span>
      )}
      <span className="event-countdown-title" dangerouslySetInnerHTML={{ __html: title }} />
      {venueName && <span className="event-countdown-venue">{venueName}</span>}
    </Link>
  );
}
