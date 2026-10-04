"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubmitPromotionRequest({ listingId, listingSlug }: { listingId: number; listingSlug: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/directory/${listingId}/request-promotion`, { method: "POST" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    router.push(`/directory/${listingSlug}`);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="dashboard-hint">
        There&apos;s no automatic payment yet — once you submit this, we&apos;ll review it and get in touch to
        arrange payment. Nothing is charged now.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Request promotion"}
      </button>
    </form>
  );
}
