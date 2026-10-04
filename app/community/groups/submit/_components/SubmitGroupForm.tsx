"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [resultMessage, setResultMessage] = useState("");

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
      const promoRes = await fetch(`/api/directory/${id}/request-promotion`, { method: "POST" });
      setResultMessage(
        promoRes.ok
          ? "Thanks — your group has been submitted, and your promotion request has also gone in. It'll run for 30 days once approved."
          : "Your group was submitted, but we couldn't send the promotion request just now — you can request it again from your group's page once it's live."
      );
    } else {
      setResultMessage("Thanks — your group has been submitted and is awaiting review.");
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return <p>{resultMessage}</p>;
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
        Optional — featured placement within the Community section for 30 days. Your listing itself is always
        free; this just gets it seen more. Subject to approval, like the listing itself.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "List your group"}
      </button>
    </form>
  );
}
