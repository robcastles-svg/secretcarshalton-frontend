"use client";

import Link from "next/link";
import { useState } from "react";

export function ClaimListingButton({
  listingId,
  isLoggedIn,
  initialPending,
}: {
  listingId: number;
  isLoggedIn: boolean;
  initialPending: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(initialPending);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link href="/login" className="button-pill button-pill-secondary">
        Is this your business? Log in to claim it
      </Link>
    );
  }

  // Claims go to Rob for review now, not straight through — see
  // SC_Directory_REST::claim_listing. The listing itself won't show as
  // claimed yet, so this has to remember the request locally rather than
  // relying on a refreshed sc_claimed flag that hasn't changed.
  if (pending) {
    return <p className="claim-pending-notice">Claim request submitted — awaiting review.</p>;
  }

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/directory/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    if (res.ok) {
      setPending(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" className="button-pill button-pill-active" onClick={handleClick} disabled={submitting}>
        {submitting ? "Submitting…" : "Is this your business? Claim this listing"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
