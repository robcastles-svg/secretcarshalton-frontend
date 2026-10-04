"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GROUP_PROMOTION_PRICE } from "@/lib/pricing";
import type { WPDirectoryCategory } from "@/lib/wordpress";

/**
 * Deliberately short — title, website, one category. Everything else
 * (address, contact details, socials, extra categories, photos) lives in
 * the upgrade flow instead: a free listing is a placeholder entry to get
 * found by name, the paid upgrade is the full profile. See
 * /dashboard/upgrade's SubmitUpgradeRequest for that longer form.
 */
export function SubmitListingForm({ categories }: { categories: WPDirectoryCategory[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [promotionRequested, setPromotionRequested] = useState(false);
  const [promotionFailed, setPromotionFailed] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const wantsPromotion = formData.get("promote") === "on";
    formData.delete("promote");
    const data = Object.fromEntries(formData.entries());

    const res = await fetch("/api/directory/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    if (wantsPromotion) {
      const { id } = await res.json();
      const promoRes = await fetch(`/api/directory/${id}/request-promotion`, { method: "POST" });
      if (promoRes.ok) {
        setPromotionRequested(true);
      } else {
        setPromotionFailed(true);
      }
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p>
        Thanks — your listing has been submitted and is awaiting review.
        {promotionRequested &&
          " Your group promotion request has also been submitted — it'll run for 30 days once approved."}
        {promotionFailed &&
          " We couldn't submit your group promotion request just now — you can request it again from your listing's page once it's live."}{" "}
        Once it&apos;s live, you can add the rest of your profile (address, contact details, photos and more) by
        requesting a featured upgrade from your dashboard.
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Business/organisation name
        <input type="text" name="title" required />
      </label>
      <label>
        Website
        <input type="url" name="website" placeholder="https://" />
      </label>
      <label>
        Category
        <select name="category" defaultValue="">
          <option value="">Choose a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="auth-form-radio">
        <input type="checkbox" name="promote" />
        Promote my group — {GROUP_PROMOTION_PRICE}
      </label>
      <p className="dashboard-hint">
        Optional — featured placement within the Community section for 30 days. Your listing itself is always
        free; this just gets it seen more. Subject to approval, like the listing itself.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit listing"}
      </button>
    </form>
  );
}
