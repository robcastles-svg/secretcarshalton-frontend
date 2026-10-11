"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayNow } from "@/app/_components/PayNow";
import { GROUP_PROMOTION_PRICE } from "@/lib/pricing";
import { GROUPS_CATEGORY_SLUG } from "@/lib/wordpress";

/**
 * Just two states — free, or free + the flat £10/30-day promotion — no
 * tier picker, no business-profile fields (address, tagline, multiple
 * categories). Category is always "Groups to join"; not shown as a
 * choice since this form only ever creates that kind of listing.
 */
export function SubmitGroupForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** Set when they ticked "Promote my group" — the next step is paying for it. */
  const [promoteId, setPromoteId] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const wantsPromotion = formData.get("promote") === "on";
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      website: formData.get("website"),
      facebook: formData.get("facebook"),
      instagram: formData.get("instagram"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      category: GROUPS_CATEGORY_SLUG,
    };

    const createRes = await fetch("/api/directory/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    if (wantsPromotion) {
      const { id } = await createRes.json();
      setPromoteId(Number(id));
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <>
        <p>Thanks — your group has been submitted and is awaiting review.</p>
        {promoteId && (
          <PayNow
            kind="group_promotion"
            id={promoteId}
            price={GROUP_PROMOTION_PRICE.split(" ")[0]}
            what="promote your group for 30 days"
            paidText="Paid — your group is promoted until {until}. It shows once we've approved the group."
          />
        )}
      </>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Group name
        <input type="text" name="title" required />
      </label>
      <label>
        Description
        <textarea name="description" rows={4} placeholder="What it's about, who it's for, when you meet…" />
      </label>
      <label>
        Website
        <input type="url" name="website" placeholder="https://" />
      </label>
      <label>
        Facebook
        <input type="url" name="facebook" placeholder="https://facebook.com/…" />
      </label>
      <label>
        Instagram
        <input type="url" name="instagram" placeholder="https://instagram.com/…" />
      </label>
      <label>
        Contact email
        <input type="email" name="email" />
      </label>
      <label>
        Contact phone
        <input type="tel" name="phone" />
      </label>

      <label className="auth-form-radio">
        <input type="checkbox" name="promote" />
        Promote my group — {GROUP_PROMOTION_PRICE}
      </label>
      <p className="dashboard-hint">
        Optional — featured placement within the Community section for 30 days, paid with PayPal on the next
        step. Your listing itself is always free; this just gets it seen more.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "List your group"}
      </button>
    </form>
  );
}
