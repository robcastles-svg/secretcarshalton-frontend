"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AD_SELF_SERVE_PLACEMENTS } from "@/lib/wordpress";

export function SubmitAdForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/ads/submit", { method: "POST", body: formData });

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
        Thanks — your ad&apos;s been submitted. It stays hidden until payment&apos;s confirmed and we switch it
        on; you&apos;ll be able to see it and its stats from your dashboard once it&apos;s live.
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Headline
        <input type="text" name="headline" required placeholder="e.g. 20% off this month at…" />
      </label>
      <label>
        Body text (optional)
        <input type="text" name="body" placeholder="A short line under the headline" />
      </label>
      <label>
        Link
        <input type="url" name="link" required placeholder="https://…" />
      </label>
      <label>
        Days
        <input type="number" name="days" min={1} defaultValue={1} required />
      </label>
      <p className="dashboard-hint">
        Pricing isn&apos;t fixed yet — roughly £2.50/day for a single day, down toward £1/day for 10+ days.
        We&apos;ll confirm the exact amount when we get in touch about payment.
      </p>
      <label>
        Placement
        <select name="placement" defaultValue="" required>
          <option value="" disabled>
            Choose where it appears…
          </option>
          {AD_SELF_SERVE_PLACEMENTS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Image (optional)
        <input type="file" name="image" accept="image/*" />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit ad"}
      </button>
    </form>
  );
}
