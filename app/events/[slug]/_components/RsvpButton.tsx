"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Deliberately not a real RSVP/ticketing action — events on this site are
 * informational (the "more info" link/box is where real sign-up happens,
 * via whatever external process the organiser uses). This is a lightweight
 * "I'm interested" signal that earns the member points, so the copy leans
 * on "interested" + the points hint rather than "going", which read like a
 * booking confirmation.
 */
export function RsvpButton({
  eventId,
  isLoggedIn,
  initialGoing,
  initialCount,
}: {
  eventId: number;
  isLoggedIn: boolean;
  initialGoing: boolean;
  initialCount: number;
}) {
  const [going, setGoing] = useState(initialGoing);
  const [count, setCount] = useState(initialCount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link href="/login" className="button-pill button-pill-secondary rsvp-button">
        Log in to say you&apos;re interested
      </Link>
    );
  }

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/rsvp`, { method: going ? "DELETE" : "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setGoing(body.going);
      setCount(body.going_count);
    } else {
      setError(body.error || "Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="rsvp-button-wrap">
      <button
        type="button"
        className={`button-pill rsvp-button${going ? " rsvp-button-going" : ""}`}
        onClick={handleClick}
        disabled={submitting}
      >
        {going ? "✓ Interested" : "I'm interested"}
      </button>
      {!going && <span className="rsvp-points-hint">Earn 5 points</span>}
      {count > 0 && (
        <span className="rsvp-count">
          {count} {count === 1 ? "person" : "people"} interested
        </span>
      )}
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
