/**
 * All of /advertise's pricing in one place — the page, the dashboard's
 * upgrade/job forms, and the dashboard's own "My business"/"My advertising"
 * display all read from here, so a price change is a one-file edit rather
 * than hunting through JSX. Holding figures (confirmed with Rob 2026-10),
 * not tied to any payment automation — every product on the site is still
 * "submit, then we arrange payment by hand" (see each submit form's own
 * copy).
 */

export const TEXT_AD_TIERS = [
  {
    placement: "sidebar",
    label: "Standard Text Ad",
    pricePerDay: 2.5,
  },
  {
    placement: "in_article",
    label: "Premium Text Ad",
    pricePerDay: 3,
  },
] as const;

export interface FeaturedDirectoryTier {
  slug: "featured" | "featured_6mo" | "featured_plus" | "featured_gold";
  label: string;
  price: string;
  per: string;
  exposureNote: string;
}

/** Slugs here are the only valid values for the <select>/radio "tier" field SubmitUpgradeRequest posts — must match SC_Membership_Hooks::VALID_UPGRADE_TIERS in wordpress-plugins/sc-membership. */
export const FEATURED_DIRECTORY_TIERS: FeaturedDirectoryTier[] = [
  {
    slug: "featured",
    label: "Featured",
    price: "£50",
    per: "per month",
    exposureNote: "Est. 50+ monthly exposure*",
  },
  {
    slug: "featured_6mo",
    label: "Featured — 6 months",
    price: "£150",
    per: "for 6 months",
    exposureNote: "6 months for the price of 3",
  },
  {
    slug: "featured_plus",
    label: "Featured Plus",
    price: "£70",
    per: "per month",
    exposureNote: "Est. 100+ monthly exposure*",
  },
  {
    slug: "featured_gold",
    label: "Featured Gold",
    price: "£150",
    per: "per month",
    exposureNote: "Est. 150+ monthly exposure*",
  },
];

export function featuredTierLabel(slug: string | null | undefined): string {
  return FEATURED_DIRECTORY_TIERS.find((t) => t.slug === slug)?.label ?? "Featured";
}

export const EVENT_UPGRADE_PRICE = "£5 per event";

/** Slugs match job_rate_bracket in wordpress-plugins/sc-jobs. */
export const JOB_RATE_BRACKETS = [
  { slug: "up_to_15", label: "Up to £15/hour", price: "£15" },
  { slug: "15_to_20", label: "£15–£20/hour", price: "£20" },
  { slug: "over_20", label: "Over £20/hour", price: "£40" },
] as const;

export const GROUP_PROMOTION_PRICE = "£10 for 30 days";

/** The basic directory tier — no longer free, per Rob's call (2026-10): a nominal yearly fee filters low-effort/spam submissions and funds the renewal touchpoint, without pricing anyone out the way a monthly fee would. Featured is unaffected by this change. */
export const STANDARD_LISTING_PRICE = "£2.50/year";
