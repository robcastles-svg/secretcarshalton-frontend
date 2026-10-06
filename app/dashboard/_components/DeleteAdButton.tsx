"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAdButton({ adId, active }: { adId: number; active: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/ads/${adId}/delete`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong — please try again.");
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="dashboard-my-list-edit" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <span className="dashboard-hint" style={{ margin: 0 }}>
        {active ? "This ad is live and already paid for — deleting it won't refund you. Delete anyway?" : "Delete this ad?"}
      </span>
      <button type="button" className="dashboard-my-list-edit" onClick={handleDelete} disabled={submitting}>
        {submitting ? "Deleting…" : "Confirm"}
      </button>
      <button type="button" className="dashboard-my-list-edit" onClick={() => setConfirming(false)} disabled={submitting}>
        Cancel
      </button>
      {error && <span className="auth-error">{error}</span>}
    </span>
  );
}
