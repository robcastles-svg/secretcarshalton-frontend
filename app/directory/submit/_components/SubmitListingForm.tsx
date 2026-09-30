"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data = Object.fromEntries(new FormData(e.currentTarget).entries());

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

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p>
        Thanks — your listing has been submitted and is awaiting review. Once it&apos;s live, you can add the
        rest of your profile (address, contact details, photos and more) by requesting a featured upgrade from
        your dashboard.
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

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit listing"}
      </button>
    </form>
  );
}
