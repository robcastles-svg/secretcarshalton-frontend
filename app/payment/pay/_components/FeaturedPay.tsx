"use client";

import { useState } from "react";
import { PayNow } from "@/app/_components/PayNow";
import { FEATURED_DIRECTORY_TIERS } from "@/lib/pricing";

/** Pick a Featured package, then pay — used for upgrading and for renewing (renewing adds on to the current period). */
export function FeaturedPay({ listingId, initialTier }: { listingId: number; initialTier?: string }) {
  const [tier, setTier] = useState(
    FEATURED_DIRECTORY_TIERS.find((t) => t.slug === initialTier)?.slug ?? FEATURED_DIRECTORY_TIERS[0].slug
  );
  const chosen = FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)!;

  return (
    <>
      <fieldset className="directory-category-fieldset">
        <legend>Package</legend>
        {FEATURED_DIRECTORY_TIERS.map((t) => (
          <label key={t.slug} className="auth-form-radio">
            <input type="radio" name="tier" value={t.slug} checked={tier === t.slug} onChange={() => setTier(t.slug)} />
            {t.label} — {t.price} {t.per}
          </label>
        ))}
      </fieldset>
      <PayNow
        key={tier}
        kind="featured"
        id={listingId}
        price={chosen.price}
        what={`${chosen.label}, ${chosen.per}`}
        extraBody={{ tier }}
        paidText="Paid — your listing is Featured until {until}. We'll email you a week before it ends."
        viewPath="/directory/"
      />
    </>
  );
}
