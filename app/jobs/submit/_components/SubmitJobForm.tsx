"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubmitJobForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/jobs/submit", { method: "POST", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p>
        Thanks — your job posting&apos;s been submitted. There&apos;s no automated payment yet, so we&apos;ll be
        in touch to arrange it (PayPal) — it goes live once that&apos;s sorted and we&apos;ve approved it. You
        can track the status from your dashboard.
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Job title
        <input type="text" name="title" required placeholder="e.g. Part-time café assistant" />
      </label>
      <label>
        Company / organisation
        <input type="text" name="company" placeholder="Who's hiring" />
      </label>
      <label>
        Salary (optional)
        <input type="text" name="salary" placeholder="e.g. £12/hour, or £24,000 - £28,000" />
      </label>
      <label>
        How to apply
        <input type="text" name="apply_url" placeholder="A link to apply, or an email address" />
      </label>
      <label>
        Description
        <textarea name="description" rows={6} required placeholder="Role, hours, what you're looking for…" />
      </label>

      <p className="dashboard-hint">
        This is a paid listing — there&apos;s no automated payment yet, so once you submit this, we&apos;ll
        review it and get in touch to arrange payment (PayPal). Nothing is charged now.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Post job"}
      </button>
    </form>
  );
}
