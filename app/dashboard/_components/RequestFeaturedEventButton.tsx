"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RequestFeaturedEventButton({ eventId }: { eventId: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/request-featured`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <span>
      <button type="button" className="dashboard-my-list-edit" onClick={handleClick} disabled={submitting}>
        {submitting ? "Requesting…" : "Request featured"}
      </button>
      {error && <span className="auth-error">{error}</span>}
    </span>
  );
}
