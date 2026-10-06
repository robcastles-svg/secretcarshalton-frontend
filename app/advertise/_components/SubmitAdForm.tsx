"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TEXT_AD_TIERS } from "@/lib/pricing";
import { AdPreview } from "./AdPreview";
import { PayPalPayButton } from "./PayPalPayButton";

function estimateCost(days: number, pricePerDay: number): number {
  return days * pricePerDay;
}

export function SubmitAdForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "payment" | "paid">("form");
  const [submittedAdId, setSubmittedAdId] = useState<number | null>(null);
  const [days, setDays] = useState(1);
  const [placement, setPlacement] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const selectedPlacement = TEXT_AD_TIERS.find((p) => p.placement === placement);

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
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(result.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    setSubmittedAdId(result.id);
    setStep("payment");
    router.refresh();
  }

  if (step === "paid") {
    return (
      <p>
        Payment confirmed — your ad is now live. You&apos;ll be able to see it and its stats from your dashboard.
      </p>
    );
  }

  if (step === "payment" && submittedAdId) {
    return (
      <div>
        <p>
          Your ad&apos;s been submitted — one step left. Pay via PayPal below to make it live
          {selectedPlacement ? (
            <>
              {" "}
              (£{estimateCost(days, selectedPlacement.pricePerDay).toFixed(2)} for {days} day
              {days === 1 ? "" : "s"} of {selectedPlacement.label.toLowerCase()})
            </>
          ) : null}
          .
        </p>
        <PayPalPayButton adId={submittedAdId} onPaid={() => setStep("paid")} />
        <p className="dashboard-hint">
          Not ready to pay right now? That&apos;s fine — it&apos;ll sit in your dashboard as unpaid until you come
          back and pay from there.
        </p>
      </div>
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
          {TEXT_AD_TIERS.map((p) => (
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
            {selectedPlacement.pricePerDay.toFixed(2)}/day for {selectedPlacement.label.toLowerCase()}).
          </>
        ) : (
          <>Estimated cost: choose a placement above to see the rate.</>
        )}{" "}
        <span className="ad-form-paypal-badge">You&apos;ll pay securely via PayPal on the next step.</span>
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
