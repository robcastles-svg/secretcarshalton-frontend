"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BanMemberButton({ userId, initialBanned }: { userId: number; initialBanned: boolean }) {
  const router = useRouter();
  const [banned, setBanned] = useState(initialBanned);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/members/${userId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: banned ? "unban" : "ban" }),
    });
    if (res.ok) {
      setBanned((prev) => !prev);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="member-moderation">
      {banned && <span className="member-banned-badge">Banned</span>}
      <button
        type="button"
        className={`button-pill button-pill-secondary${banned ? "" : " member-ban-button"}`}
        onClick={handleClick}
        disabled={submitting}
      >
        {submitting ? "Working…" : banned ? "Unban member" : "Ban / spam member"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
