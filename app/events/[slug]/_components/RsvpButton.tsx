"use client";

import Link from "next/link";
import { useState } from "react";
import { StarIcon } from "../../_components/EvIcons";

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
      <Link href="/login" className="evx-btn">
        <StarIcon />
        I&apos;m interested
        <span className="evx-pts">+5</span>
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
    <>
      <button
        type="button"
        className="evx-btn"
        aria-pressed={going}
        onClick={handleClick}
        disabled={submitting}
        title={count > 0 ? `${count} ${count === 1 ? "person" : "people"} interested` : undefined}
      >
        <StarIcon />
        {going ? "Interested" : "I'm interested"}
        <span className="evx-pts">+5</span>
      </button>
      {error && <p className="auth-error">{error}</p>}
    </>
  );
}
