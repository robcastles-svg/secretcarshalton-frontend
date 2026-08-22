"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimListingButton({
  listingId,
  isLoggedIn,
}: {
  listingId: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link href="/login" className="button-pill button-pill-secondary">
        Is this your business? Log in to claim it
      </Link>
    );
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
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" className="button-pill button-pill-secondary" onClick={handleClick} disabled={submitting}>
        {submitting ? "Claiming…" : "Is this your business? Claim this listing"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
