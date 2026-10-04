"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BLUE_AD_TIERS } from "@/lib/pricing";
import { AdPreview } from "./AdPreview";

function estimateCost(days: number, pricePerDay: number): number {
  return days * pricePerDay;
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

  const selectedPlacement = BLUE_AD_TIERS.find((p) => p.placement === placement);

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
          {BLUE_AD_TIERS.map((p) => (
            <option key={p.placement} value={p.placement}>
              {p.label} — £{p.pricePerDay.toFixed(2)}/day
            </option>
          ))}
        </select>
      </label>
      <p className="dashboard-hint">
        {selectedPlacement ? (
          <>
            Estimated cost: <strong>£{estimateCost(days, selectedPlacement.pricePerDay).toFixed(2)}</strong> (£
            {selectedPlacement.pricePerDay.toFixed(2)}/day for {selectedPlacement.label.toLowerCase()} —
            discounts available for 10+ bookings).
          </>
        ) : (
          <>Estimated cost: choose a placement above to see the rate.</>
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
