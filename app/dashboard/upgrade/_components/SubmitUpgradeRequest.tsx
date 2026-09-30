"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MyListing } from "@/lib/wordpress";

export function SubmitUpgradeRequest({ listings }: { listings: MyListing[] }) {
  const router = useRouter();
  const [listingId, setListingId] = useState(listings[0]?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!listingId) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/membership/request-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {listings.length > 1 ? (
        <fieldset className="directory-category-fieldset">
          <legend>Which listing?</legend>
          {listings.map((listing) => (
            <label key={listing.id} className="auth-form-radio">
              <input
                type="radio"
                name="listing"
                value={listing.id}
                checked={listingId === listing.id}
                onChange={() => setListingId(listing.id)}
              />
              {listing.title}
            </label>
          ))}
        </fieldset>
      ) : (
        <p>
          Requesting a featured upgrade for <strong>{listings[0]?.title}</strong>.
        </p>
      )}

      <p className="dashboard-hint">
        There&apos;s no automatic payment yet — once you submit this, we&apos;ll review it and get in touch to
        arrange payment. Nothing is charged now.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting || !listingId}>
        {submitting ? "Submitting…" : "Request upgrade"}
      </button>
    </form>
  );
}
