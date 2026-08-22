"use client";

import Link from "next/link";
import { useState } from "react";

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
        Log in to say you&apos;re going
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
        {going ? "✓ You're going" : "I'm going"}
      </button>
      {count > 0 && (
        <span className="rsvp-count">
          {count} {count === 1 ? "person" : "people"} going
        </span>
      )}
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
