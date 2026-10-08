"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FEATURED_DIRECTORY_TIERS } from "@/lib/pricing";
import type { MyListing, WPDirectoryCategory } from "@/lib/wordpress";

/** Mirrors SC_Directory_REST's PAID_PHOTO_LIMIT — advisory only, the server enforces the real cap (counting photos the listing already has). One category per listing, so a single dropdown. */
const PHOTO_LIMIT = 3;

export function SubmitUpgradeRequest({
  listings,
  categories,
}: {
  listings: MyListing[];
  categories: WPDirectoryCategory[];
}) {
  const router = useRouter();
  const [listingId, setListingId] = useState(listings[0]?.id ?? null);
  const [tier, setTier] = useState(FEATURED_DIRECTORY_TIERS[0].slug);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!listingId) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    // Blank leaves the listing's current category as it is.
    if (selectedCategory) formData.set("category", selectedCategory);
    photos.slice(0, PHOTO_LIMIT).forEach((file) => formData.append("photos[]", file));

    const res = await fetch(`/api/directory/${listingId}/request-upgrade`, {
      method: "POST",
      body: formData,
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
        Thanks — your upgrade request and the extra details are in. There&apos;s no automated payment yet, so
        we&apos;ll be in touch to arrange it (PayPal) — your listing goes featured once that&apos;s sorted and
        we&apos;ve approved it. You can track the status from your dashboard.
      </p>
    );
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

      <fieldset className="upgrade-tier-fieldset">
        <legend>Package</legend>
        <div className="upgrade-tier-grid">
          {FEATURED_DIRECTORY_TIERS.map((t) => (
            <label
              key={t.slug}
              className={`upgrade-tier-card${tier === t.slug ? " upgrade-tier-card-selected" : ""}`}
            >
              <input
                type="radio"
                name="tier"
                value={t.slug}
                checked={tier === t.slug}
                onChange={() => setTier(t.slug)}
              />
              <span className="upgrade-tier-name">{t.label}</span>
              <span className="upgrade-tier-price">
                {t.price} <span className="upgrade-tier-per">{t.per}</span>
              </span>
              <span className="upgrade-tier-exposure">{t.exposureNote}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Category
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="">Keep current category</option>
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
        Photos (up to {PHOTO_LIMIT} in total, including any your listing already has)
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, PHOTO_LIMIT))}
        />
      </label>
      {photos.length > 0 && <p className="auth-hint">{photos.length} photo(s) selected.</p>}

      <p className="dashboard-hint">
        {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.label}:{" "}
        {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.price}{" "}
        {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.per}. There&apos;s no automated payment yet —
        once you submit this, we&apos;ll review it and get in touch to arrange payment (PayPal). Nothing is
        charged now.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting || !listingId}>
        {submitting ? "Submitting…" : "Request upgrade"}
      </button>
    </form>
  );
}
