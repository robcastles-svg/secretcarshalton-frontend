"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RequestUpgradeButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/membership/request-upgrade", { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" className="button-pill" onClick={handleClick} disabled={submitting}>
        {submitting ? "Requesting…" : "Request directory upgrade"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
