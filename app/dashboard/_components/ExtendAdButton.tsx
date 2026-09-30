"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExtendAdButton({ adId }: { adId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/ads/${adId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  if (!open) {
    return (
      <button type="button" className="dashboard-my-list-edit" onClick={() => setOpen(true)}>
        Add more days
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <input
        type="number"
        min={1}
        value={days}
        onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
        style={{ width: "4rem" }}
      />
      <button type="submit" className="dashboard-my-list-edit" disabled={submitting}>
        {submitting ? "Adding…" : "Confirm"}
      </button>
      {error && <span className="auth-error">{error}</span>}
    </form>
  );
}
