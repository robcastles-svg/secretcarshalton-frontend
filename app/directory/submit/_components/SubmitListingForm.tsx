"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FEATURED_DIRECTORY_TIERS, STANDARD_LISTING_PRICE } from "@/lib/pricing";
import type { WPDirectoryCategory } from "@/lib/wordpress";

/** Mirrors SC_Directory_REST's PAID_CATEGORY_LIMIT/PAID_PHOTO_LIMIT — advisory only, the server enforces the real cap. */
const CATEGORY_LIMIT = 3;
const PHOTO_LIMIT = 10;

/**
 * Business/organisation directory listing form, used in two distinct
 * contexts — see /directory/submit (standard one-pager) and
 * /directory/featured (premium one-pager) — rather than one combined
 * standard+upgrade page/form. `mode="standard"` shows just the basic
 * fields and creates a Standard-tier listing (STANDARD_LISTING_PRICE —
 * no longer free, per Rob's call 2026-10); `mode="featured"` shows a
 * tier picker across the four Featured packages plus the richer
 * profile fields (same ones /dashboard/upgrade's SubmitUpgradeRequest
 * asks for). Submitting always creates the listing first (POST
 * /api/directory/submit), then — in featured mode — makes one follow-up
 * request against the new listing's id to request the upgrade.
 *
 * Community groups are a deliberately separate, simpler flow — see
 * /community/groups/submit's SubmitGroupForm — not this one: groups
 * have no Featured tiers, just free or the flat £10 promotion, and
 * mixing that choice into this business-focused form read as confusing
 * ("promote my group" on a form titled "business/organisation name").
 */
export function SubmitListingForm({
  categories,
  mode,
  initialTier,
}: {
  categories: WPDirectoryCategory[];
  mode: "standard" | "featured";
  /** Featured mode only — pre-selects one of FEATURED_DIRECTORY_TIERS' slugs. */
  initialTier?: string;
}) {
  const router = useRouter();
  const [tier, setTier] = useState(
    mode === "featured"
      ? FEATURED_DIRECTORY_TIERS.find((t) => t.slug === initialTier)?.slug ?? FEATURED_DIRECTORY_TIERS[0].slug
      : "standard"
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const isFeatured = mode === "featured";

  function toggleCategory(slug: string) {
    setSelectedCategories((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= CATEGORY_LIMIT) return prev;
      return [...prev, slug];
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const basicData = {
      title: formData.get("title"),
      website: formData.get("website"),
      category: formData.get("category"),
    };

    const createRes = await fetch("/api/directory/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basicData),
    });

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    const { id } = await createRes.json();

    if (isFeatured) {
      const upgradeData = new FormData();
      upgradeData.set("tier", tier);
      for (const field of [
        "tagline",
        "description",
        "address_street",
        "address_town",
        "address_region",
        "address_postcode",
        "address_country",
        "phone",
        "email",
        "facebook",
        "instagram",
        "twitter",
        "linkedin",
        "youtube",
      ]) {
        upgradeData.set(field, formData.get(field) ?? "");
      }
      selectedCategories.forEach((slug) => upgradeData.append("categories", slug));
      photos.slice(0, PHOTO_LIMIT).forEach((file) => upgradeData.append("photos[]", file));

      const upgradeRes = await fetch(`/api/directory/${id}/request-upgrade`, {
        method: "POST",
        body: upgradeData,
      });

      setResultMessage(
        upgradeRes.ok
          ? "Thanks — your listing and Featured request are both in. There's no automated payment yet, so we'll be in touch to arrange it (PayPal); your listing goes featured once that's sorted and we've approved it."
          : "Your listing was submitted, but we couldn't send the Featured request just now — you can request it again from your dashboard once the listing's live."
      );
    } else {
      setResultMessage(
        `Thanks — your listing has been submitted. There's no automated payment yet, so we'll review it and get in touch to arrange the ${STANDARD_LISTING_PRICE} payment (PayPal); nothing's charged now. Once it's live, you can add the rest of your profile (address, contact details, photos and more) by requesting a Featured upgrade from your dashboard.`
      );
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

      {mode === "featured" && (
        <label>
          Package
          <select name="tier" value={tier} onChange={(e) => setTier(e.target.value)}>
            {FEATURED_DIRECTORY_TIERS.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label} — {t.price} {t.per}
              </option>
            ))}
          </select>
        </label>
      )}

      {isFeatured ? (
        <>
          <fieldset className="directory-category-fieldset">
            <legend>
              Categories ({selectedCategories.length}/{CATEGORY_LIMIT})
            </legend>
            {categories.map((c) => (
              <label key={c.id} className="directory-category-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.slug)}
                  onChange={() => toggleCategory(c.slug)}
                  disabled={!selectedCategories.includes(c.slug) && selectedCategories.length >= CATEGORY_LIMIT}
                />
                {c.name}
              </label>
            ))}
          </fieldset>

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
            Photos (up to {PHOTO_LIMIT})
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, PHOTO_LIMIT))}
            />
          </label>
          {photos.length > 0 && <p className="auth-hint">{photos.length} photo(s) selected.</p>}
        </>
      ) : null}

      <p className="dashboard-hint">
        {isFeatured ? (
          <>
            {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.label}:{" "}
            {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.price}{" "}
            {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.per}. There&apos;s no automated payment yet — once you
            submit this, we&apos;ll review it and get in touch to arrange payment (PayPal). Nothing is charged
            now.
          </>
        ) : (
          <>
            Standard listing: {STANDARD_LISTING_PRICE}. There&apos;s no automated payment yet — once you submit
            this, we&apos;ll review it and get in touch to arrange payment (PayPal). Nothing is charged now.
          </>
        )}
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : isFeatured ? "Submit & request Featured" : "Submit listing"}
      </button>
    </form>
  );
}
