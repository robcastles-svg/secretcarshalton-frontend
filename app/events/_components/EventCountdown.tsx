"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventImage } from "@/app/_components/EventImage";

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
 * Matches EventON's live "Coming up Next in ___" countdown — ticks
 * client-side. Normally shows whichever event is chronologically
 * soonest, but a paid-upgrade "featured" event (SC_Events_Meta's
 * sc_event_featured, admin-set) takes this slot instead when one exists
 * — see the `featured` prop and how /events/page.tsx picks heroEvent.
 */
export function EventCountdown({
  title,
  slug,
  startIso,
  venueName,
  image,
  imageAlt,
  featured,
}: {
  title: string;
  slug: string;
  startIso: string;
  venueName?: string;
  image: { source_url: string; alt_text: string } | null;
  imageAlt: string;
  featured?: boolean;
}) {
  const startDate = new Date(startIso);
  const target = startDate.getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(timeRemaining(target));
    const interval = setInterval(() => setRemaining(timeRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <Link href={`/events/${slug}`} className="event-countdown">
      <div className="event-countdown-media">
        <EventImage image={image} alt={imageAlt} />
      </div>
      <div className="event-countdown-heading">
        <div className="event-countdown-date-badge">
          <span className="event-countdown-date-badge-weekday">
            {startDate.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
          </span>
          <span className="event-countdown-date-badge-day">{startDate.getDate()}</span>
          <span className="event-countdown-date-badge-month">
            {startDate.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
          </span>
        </div>
        <div className="event-countdown-body">
          {featured && <span className="event-countdown-featured-badge">Featured</span>}
          <span className="event-countdown-title" dangerouslySetInnerHTML={{ __html: title }} />
          {venueName && <span className="event-countdown-venue">{venueName}</span>}
        </div>
      </div>
      <div className="event-countdown-timer-wrap">
        <span className="event-countdown-label">Countdown to event</span>
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
      </div>
    </Link>
  );
}
