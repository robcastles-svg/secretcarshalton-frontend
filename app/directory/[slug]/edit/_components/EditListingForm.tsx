"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WPDirectoryCategory } from "@/lib/wordpress";

export interface EditListingInitial {
  title: string;
  description: string;
  category: string;
  address_street: string;
  address_town: string;
  address_region: string;
  address_postcode: string;
  address_country: string;
  phone: string;
  website: string;
}

export function EditListingForm({
  listingId,
  listingSlug,
  categories,
  initial,
}: {
  listingId: number;
  listingSlug: string;
  categories: WPDirectoryCategory[];
  initial: EditListingInitial;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const category = categories.find((c) => c.slug === String(form.get("category") ?? ""));

    const res = await fetch(`/api/directory/${listingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(form.get("title") ?? ""),
        content: String(form.get("description") ?? ""),
        sc_listing_category: category ? [category.id] : [],
        meta: {
          sc_address_street: String(form.get("address_street") ?? ""),
          sc_address_town: String(form.get("address_town") ?? ""),
          sc_address_region: String(form.get("address_region") ?? ""),
          sc_address_postcode: String(form.get("address_postcode") ?? ""),
          sc_address_country: String(form.get("address_country") ?? ""),
          sc_phone: String(form.get("phone") ?? ""),
          sc_website: String(form.get("website") ?? ""),
        },
      }),
    });

    if (res.ok) {
      router.push(`/directory/${listingSlug}`);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Business/organisation name
        <input type="text" name="title" defaultValue={initial.title} required />
      </label>
      <label>
        Category
        <select name="category" defaultValue={initial.category}>
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
        <textarea name="description" rows={4} defaultValue={initial.description} />
      </label>
      <label>
        Street address
        <input type="text" name="address_street" defaultValue={initial.address_street} />
      </label>
      <label>
        Town
        <input type="text" name="address_town" defaultValue={initial.address_town} />
      </label>
      <label>
        Region
        <input type="text" name="address_region" defaultValue={initial.address_region} />
      </label>
      <label>
        Postcode
        <input type="text" name="address_postcode" defaultValue={initial.address_postcode} />
      </label>
      <label>
        Country
        <input type="text" name="address_country" defaultValue={initial.address_country} />
      </label>
      <label>
        Phone
        <input type="tel" name="phone" defaultValue={initial.phone} />
      </label>
      <label>
        Website
        <input type="url" name="website" placeholder="https://" defaultValue={initial.website} />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill button-pill-active" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
