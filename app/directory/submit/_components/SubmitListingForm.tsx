"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayNow, SubscribeNow } from "@/app/_components/PayNow";
import { FEATURED_DIRECTORY_TIERS, STANDARD_LISTING_PRICE } from "@/lib/pricing";
import type { WPDirectoryCategory } from "@/lib/wordpress";
import { shrinkFormImages, shrinkImage } from "@/lib/shrink-image";

/** Mirrors SC_Directory_REST's PAID_PHOTO_LIMIT — advisory only, the server enforces the real cap. One category per listing, so that's just the single dropdown. */
const PHOTO_LIMIT = 3;

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosTrimmed, setPhotosTrimmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the listing exists — the next step is paying for it. */
  const [created, setCreated] = useState<{ id: number; upgradeSaved: boolean } | null>(null);

  const isFeatured = mode === "featured";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = await shrinkFormImages(new FormData(e.currentTarget));
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
      upgradeData.set("pay", "1");
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
      upgradeData.set("category", (formData.get("category") as string) ?? "");
      for (const file of photos.slice(0, PHOTO_LIMIT)) upgradeData.append("photos[]", await shrinkImage(file, 2000));

      const upgradeRes = await fetch(`/api/directory/${id}/request-upgrade`, {
        method: "POST",
        body: upgradeData,
      });

      setCreated({ id, upgradeSaved: upgradeRes.ok });
    } else {
      setCreated({ id, upgradeSaved: false });
    }
    router.refresh();
  }

  if (created) {
    const chosen = FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier);
    return (
      <>
        <p>Thanks — your listing is saved. Pay below and it goes live straight away.</p>
        {isFeatured && chosen ? (
          <>
            {!created.upgradeSaved && (
              <p className="dashboard-hint">
                We couldn&apos;t save your extra details just now — you can add them from your dashboard after paying.
              </p>
            )}
            <PayNow
              kind="featured"
              id={created.id}
              price={chosen.price}
              what={`${chosen.label}, ${chosen.per}`}
              extraBody={{ tier }}
              paidText="Paid — your Featured listing is live until {until}. We'll email you a week before it ends."
              viewPath="/directory/"
            />
          </>
        ) : (
          <SubscribeNow kind="standard_listing" id={created.id} price={STANDARD_LISTING_PRICE} what="standard directory listing" />
        )}
        <p className="dashboard-hint">You can also pay later from your dashboard.</p>
      </>
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
            Photos (up to {PHOTO_LIMIT} — the first is your cover image)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPhotosTrimmed(files.length > PHOTO_LIMIT);
                setPhotos(files.slice(0, PHOTO_LIMIT));
              }}
            />
          </label>
          {photos.length > 0 && (
            <p className="auth-hint">
              {photos.length} photo(s) selected.
              {photosTrimmed && ` Only the first ${PHOTO_LIMIT} will be used.`}
            </p>
          )}
        </>
      ) : null}

      <p className="dashboard-hint">
        {isFeatured ? (
          <>
            {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.label}:{" "}
            {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.price}{" "}
            {FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.per}. You&apos;ll pay with PayPal on the next
            step, and your listing goes live as soon as it&apos;s paid.
          </>
        ) : (
          <>
            Standard listing: {STANDARD_LISTING_PRICE}, renewing automatically each year. You&apos;ll set up the
            payment with PayPal on the next step, and your listing goes live as soon as it&apos;s done.
          </>
        )}
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Saving…" : "Continue to payment"}
      </button>
    </form>
  );
}
