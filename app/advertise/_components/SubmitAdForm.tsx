"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AD_SELF_SERVE_PLACEMENTS } from "@/lib/wordpress";
import { AdPreview } from "./AdPreview";

/**
 * Holding figures, not final pricing (Rob confirmed using these while the
 * real pricing gets settled): £2.50/day under 10 days, £1/day at 10+,
 * scaled by the placement's rateMultiplier (see AD_SELF_SERVE_PLACEMENTS —
 * sidebar stays the plain baseline, in-article costs more since it's the
 * more-likely-to-be-seen spot). A plain two-tier day rate, not a smooth
 * taper — simplest honest reading of "£2.50 for one day, down to £1 in
 * blocks of 10 or more".
 */
function dayRate(days: number, multiplier: number): number {
  const base = days >= 10 ? 1 : 2.5;
  return base * multiplier;
}

function estimateCost(days: number, multiplier: number): number {
  return days * dayRate(days, multiplier);
}

export function SubmitAdForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [days, setDays] = useState(1);
  const [placement, setPlacement] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const selectedPlacement = AD_SELF_SERVE_PLACEMENTS.find((p) => p.slug === placement);
  const multiplier = selectedPlacement?.rateMultiplier ?? 1;

  // Object URLs must be revoked or they leak — only ever hold the latest one.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const file = e.target.files?.[0];
    setImageUrl(file ? URL.createObjectURL(file) : null);
  }

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
        <input
          type="text"
          name="headline"
          required
          placeholder="e.g. 20% off this month at…"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
      </label>
      <label>
        Body text (optional)
        <input
          type="text"
          name="body"
          placeholder="A short line under the headline"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label>
        Link
        <input type="url" name="link" required placeholder="https://…" />
      </label>
      <label>
        Days
        <input
          type="number"
          name="days"
          min={1}
          value={days}
          onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
          required
        />
      </label>
      <label>
        Placement
        <select
          name="placement"
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose where it appears…
          </option>
          {AD_SELF_SERVE_PLACEMENTS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
              {p.rateMultiplier !== 1 ? ` — +${Math.round((p.rateMultiplier - 1) * 100)}%, seen more` : " — standard rate"}
            </option>
          ))}
        </select>
      </label>
      <p className="dashboard-hint">
        {selectedPlacement ? (
          <>
            Estimated cost: <strong>£{estimateCost(days, multiplier).toFixed(2)}</strong> (£
            {dayRate(days, multiplier).toFixed(2)}/day for {selectedPlacement.label.toLowerCase()} — holding
            figures while pricing gets finalised).
          </>
        ) : (
          <>Estimated cost: choose a placement above to see the rate (holding figures while pricing gets finalised).</>
        )}{" "}
        We&apos;ll confirm the exact amount when we get in touch about payment.
      </p>
      <label>
        Image (optional)
        <input type="file" name="image" accept="image/*" onChange={handleImageChange} />
      </label>

      <div className="ad-form-preview">
        <p className="dashboard-hint">Preview — this is what it&apos;ll actually look like:</p>
        <AdPreview headline={headline} body={body} imageUrl={imageUrl} />
      </div>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit ad"}
      </button>
    </form>
  );
}
