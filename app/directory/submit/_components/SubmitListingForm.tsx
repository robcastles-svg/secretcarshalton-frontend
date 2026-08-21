"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WPDirectoryCategory } from "@/lib/wordpress";

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

    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return <p>Thanks — your listing has been submitted and is awaiting review.</p>;
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Business/organisation name
        <input type="text" name="title" required />
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
      <label>
        Description
        <textarea name="description" rows={4} />
      </label>
      <label>
        Street address
        <input type="text" name="address_street" />
      </label>
      <label>
        Town
        <input type="text" name="address_town" defaultValue="Carshalton" />
      </label>
      <label>
        Region
        <input type="text" name="address_region" defaultValue="Surrey" />
      </label>
      <label>
        Postcode
        <input type="text" name="address_postcode" />
      </label>
      <label>
        Country
        <input type="text" name="address_country" defaultValue="United Kingdom" />
      </label>
      <label>
        Phone
        <input type="tel" name="phone" />
      </label>
      <label>
        Website
        <input type="url" name="website" placeholder="https://" />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit listing"}
      </button>
    </form>
  );
}
