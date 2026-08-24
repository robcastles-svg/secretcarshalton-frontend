"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WPDirectoryCategory } from "@/lib/wordpress";

/** New listings always start on the free plan (see SC_Directory_REST::submit_listing) — one photo cap to match. */
const FREE_PHOTO_LIMIT = 3;

export function SubmitListingForm({ categories }: { categories: WPDirectoryCategory[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

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

    const { id } = await res.json();
    if (id && photos.length > 0) {
      const photoData = new FormData();
      photos.slice(0, FREE_PHOTO_LIMIT).forEach((file) => photoData.append("photos[]", file));
      // Best-effort — the listing itself is already submitted; a failed photo
      // upload shouldn't block confirming the submission, just skip the gallery.
      await fetch(`/api/directory/${id}/photos`, { method: "POST", body: photoData }).catch(() => {});
    }

    setDone(true);
    router.refresh();
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
        Short tagline
        <input type="text" name="tagline" maxLength={140} placeholder="A one-line summary shown on listing cards" />
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
        Email
        <input type="email" name="email" />
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
        Twitter / X
        <input type="url" name="twitter" placeholder="https://x.com/…" />
      </label>
      <label>
        LinkedIn
        <input type="url" name="linkedin" placeholder="https://linkedin.com/company/…" />
      </label>
      <label>
        YouTube
        <input type="url" name="youtube" placeholder="https://youtube.com/@…" />
      </label>
      <label>
        Photos (up to {FREE_PHOTO_LIMIT})
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, FREE_PHOTO_LIMIT))}
        />
      </label>
      {photos.length > 0 && <p className="auth-hint">{photos.length} photo(s) selected.</p>}
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit listing"}
      </button>
    </form>
  );
}
