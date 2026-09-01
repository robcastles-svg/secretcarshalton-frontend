"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimEventButton({
  eventId,
  isLoggedIn,
}: {
  eventId: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link href="/login" className="button-pill button-pill-secondary">
        Is this your event? Log in to claim it
      </Link>
    );
  }

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/claim`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" className="button-pill button-pill-active" onClick={handleClick} disabled={submitting}>
        {submitting ? "Claiming…" : "Is this your event? Claim it"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
