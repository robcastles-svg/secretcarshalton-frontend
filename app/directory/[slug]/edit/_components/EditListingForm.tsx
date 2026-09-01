"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { WPDirectoryCategory, WPListingGalleryImage } from "@/lib/wordpress";

/** Mirrors SC_Directory_REST's FREE_CATEGORY_LIMIT/PAID_CATEGORY_LIMIT/FREE_PHOTO_LIMIT/PAID_PHOTO_LIMIT — advisory only, the server enforces the real cap. */
const CATEGORY_LIMIT: Record<string, number> = { free: 1, paid: 3 };
const PHOTO_LIMIT: Record<string, number> = { free: 3, paid: 10 };

export interface EditListingInitial {
  title: string;
  description: string;
  tagline: string;
  categories: string[];
  address_street: string;
  address_town: string;
  address_region: string;
  address_postcode: string;
  address_country: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  plan: string;
  claimed: boolean;
  claimExpiresAt: string;
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function EditListingForm({
  listingId,
  listingSlug,
  categories,
  initial,
  gallery,
}: {
  listingId: number;
  listingSlug: string;
  categories: WPDirectoryCategory[];
  initial: EditListingInitial;
  gallery: WPListingGalleryImage[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial.categories);
  const [currentGallery, setCurrentGallery] = useState(gallery);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<number | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [claimExpiresAt, setClaimExpiresAt] = useState(initial.claimExpiresAt);

  const categoryLimit = CATEGORY_LIMIT[initial.plan] ?? CATEGORY_LIMIT.free;
  const photoLimit = PHOTO_LIMIT[initial.plan] ?? PHOTO_LIMIT.free;

  // router.refresh() (used after a photo upload) re-runs the server
  // component and passes a new `gallery` prop, but doesn't remount this
  // client component — without this, currentGallery would keep showing
  // the pre-upload list since useState only reads its initial value once.
  useEffect(() => {
    setCurrentGallery(gallery);
  }, [gallery]);

  function toggleCategory(slug: string) {
    setSelectedCategories((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= categoryLimit) return prev;
      return [...prev, slug];
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const data: Record<string, string | string[]> = { categories: selectedCategories };
    for (const key of [
      "title",
      "description",
      "tagline",
      "address_street",
      "address_town",
      "address_region",
      "address_postcode",
      "address_country",
      "phone",
      "email",
      "website",
      "facebook",
      "instagram",
      "twitter",
      "linkedin",
      "youtube",
    ]) {
      data[key] = String(form.get(key) ?? "");
    }

    const res = await fetch(`/api/directory/${listingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
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

  async function handleAddPhotos() {
    if (newPhotos.length === 0) return;
    setUploadingPhotos(true);
    setPhotoError(null);

    const photoData = new FormData();
    newPhotos.forEach((file) => photoData.append("photos[]", file));

    const res = await fetch(`/api/directory/${listingId}/photos`, { method: "POST", body: photoData });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setNewPhotos([]);
      router.refresh();
      // The upload response only carries attachment IDs, not URLs — a full
      // refresh already re-fetches the listing with resolved sc_gallery_images,
      // so just clear the picker rather than trying to re-derive URLs here.
    } else {
      setPhotoError(body.error || "Could not upload photo(s).");
    }
    setUploadingPhotos(false);
  }

  async function handleRemovePhoto(attachmentId: number) {
    setRemovingPhotoId(attachmentId);
    setPhotoError(null);

    const res = await fetch(`/api/directory/${listingId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    if (res.ok) {
      setCurrentGallery((prev) => prev.filter((p) => p.id !== attachmentId));
    } else {
      const body = await res.json().catch(() => ({}));
      setPhotoError(body.error || "Could not remove that photo.");
    }
    setRemovingPhotoId(null);
  }

  async function handleRenewClaim() {
    setRenewing(true);
    setRenewError(null);
    const res = await fetch(`/api/directory/${listingId}/renew-claim`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setClaimExpiresAt(body.expires_at);
    } else {
      setRenewError(body.error || "Could not renew the claim.");
    }
    setRenewing(false);
  }

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Business/organisation name
          <input type="text" name="title" defaultValue={initial.title} required />
        </label>
        <fieldset className="directory-category-fieldset">
          <legend>
            Categories ({selectedCategories.length}/{categoryLimit}
            {categoryLimit === CATEGORY_LIMIT.free && ' — upgrade for more'})
          </legend>
          {categories.map((c) => (
            <label key={c.id} className="directory-category-checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.slug)}
                onChange={() => toggleCategory(c.slug)}
                disabled={!selectedCategories.includes(c.slug) && selectedCategories.length >= categoryLimit}
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <label>
          Short tagline
          <input type="text" name="tagline" maxLength={140} defaultValue={initial.tagline} placeholder="A one-line summary shown on listing cards" />
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
          Email
          <input type="email" name="email" defaultValue={initial.email} />
        </label>
        <label>
          Website
          <input type="url" name="website" placeholder="https://" defaultValue={initial.website} />
        </label>
        <label>
          Facebook
          <input type="url" name="facebook" placeholder="https://facebook.com/…" defaultValue={initial.facebook} />
        </label>
        <label>
          Instagram
          <input type="url" name="instagram" placeholder="https://instagram.com/…" defaultValue={initial.instagram} />
        </label>
        <label>
          Twitter / X
          <input type="url" name="twitter" placeholder="https://x.com/…" defaultValue={initial.twitter} />
        </label>
        <label>
          LinkedIn
          <input type="url" name="linkedin" placeholder="https://linkedin.com/company/…" defaultValue={initial.linkedin} />
        </label>
        <label>
          YouTube
          <input type="url" name="youtube" placeholder="https://youtube.com/@…" defaultValue={initial.youtube} />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="button-pill button-pill-active" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="directory-gallery-manager">
        <h2>Photos</h2>
        {currentGallery.length > 0 && (
          <ul className="directory-gallery-grid">
            {currentGallery.map((photo) => (
              <li key={photo.id}>
                <img src={photo.url} alt={photo.alt || initial.title} loading="lazy" />
                <button
                  type="button"
                  className="directory-gallery-remove"
                  onClick={() => handleRemovePhoto(photo.id)}
                  disabled={removingPhotoId === photo.id}
                >
                  {removingPhotoId === photo.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {currentGallery.length < photoLimit ? (
          <div className="directory-gallery-add">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setNewPhotos(Array.from(e.target.files ?? []).slice(0, photoLimit - currentGallery.length))
              }
            />
            <button type="button" className="button-pill button-pill-secondary" onClick={handleAddPhotos} disabled={uploadingPhotos || newPhotos.length === 0}>
              {uploadingPhotos ? "Uploading…" : `Add photo(s) (${currentGallery.length}/${photoLimit})`}
            </button>
          </div>
        ) : (
          <p className="auth-hint">
            You&apos;ve reached this listing&apos;s photo limit ({photoLimit}
            {initial.plan === "free" && " — upgrade for more"}).
          </p>
        )}
        {photoError && <p className="auth-error">{photoError}</p>}
      </div>

      {initial.claimed && (
        <div className="directory-claim-expiry">
          {claimExpiresAt ? (
            <>
              <p>Your claim on this listing is verified until {formatExpiry(claimExpiresAt)}.</p>
              <button type="button" className="button-pill button-pill-secondary" onClick={handleRenewClaim} disabled={renewing}>
                {renewing ? "Renewing…" : "Renew claim"}
              </button>
            </>
          ) : (
            <p>This listing was verified as part of the directory migration and doesn&apos;t expire.</p>
          )}
          {renewError && <p className="auth-error">{renewError}</p>}
        </div>
      )}
    </>
  );
}
