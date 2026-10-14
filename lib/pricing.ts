/**
 * All of /advertise's pricing in one place — the page, the dashboard's
 * upgrade/job forms, and the dashboard's own "My business"/"My advertising"
 * display all read from here, so a price change is a one-file edit rather
 * than hunting through JSX (confirmed with Rob 2026-10). These are labels
 * only: what's actually charged is set on the WordPress side (sc-ads'
 * shared checkout and the products that plug into it), so a price change
 * means changing both.
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

/** Text ad length limits — must match SC_Ads_REST::HEADLINE_MAX / BODY_MAX. */
export const AD_HEADLINE_MAX = 40;
export const AD_BODY_MAX = 110;

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

/**
 * Job posts are priced on the hourly rate, in round bands (Rob, 2026-10):
 * most local jobs are hourly. A yearly salary is converted at
 * HOURS_PER_YEAR (37.5 hours × 52 weeks), so the cut-offs are £29,250 and
 * £39,000 a year. Slugs and cut-offs must match SC_Jobs_REST in
 * wordpress-plugins/sc-jobs, which decides the band itself from the pay
 * entered. The jobs page lists the bands by hourlyLabel; the form adds
 * label (the yearly figure) in brackets.
 */
export const HOURS_PER_YEAR = 1950;

export const JOB_RATE_BRACKETS = [
  { slug: "up_to_15", label: "Under £29,250 a year", hourlyLabel: "Under £15 an hour", price: "£15" },
  { slug: "15_to_20", label: "£29,250–£39,000 a year", hourlyLabel: "£15–£20 an hour", price: "£20" },
  { slug: "over_20", label: "Over £39,000 a year", hourlyLabel: "Over £20 an hour", price: "£40" },
] as const;

export type SalaryPeriod = "hour" | "year";

export function annualSalary(amount: number, period: SalaryPeriod): number {
  return period === "hour" ? amount * HOURS_PER_YEAR : amount;
}

/** Under £15 an hour → first band; £15 up to and including £20 → second; over £20 → third (compared as yearly figures). */
export function jobRateBracket(annual: number) {
  if (annual < 15 * HOURS_PER_YEAR) return JOB_RATE_BRACKETS[0];
  if (annual <= 20 * HOURS_PER_YEAR) return JOB_RATE_BRACKETS[1];
  return JOB_RATE_BRACKETS[2];
}

function pounds(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "£18 per hour (about £35,100 a year)" / "£30,000 a year (about £15.38 per hour)" — same wording SC_Jobs_REST saves. */
export function formatJobSalary(amount: number, period: SalaryPeriod): string {
  if (period === "hour") return `${pounds(amount)} per hour (about ${pounds(Math.round(amount * HOURS_PER_YEAR))} a year)`;
  return `${pounds(amount)} a year (about ${pounds(Math.round((amount / HOURS_PER_YEAR) * 100) / 100)} per hour)`;
}

export const GROUP_PROMOTION_PRICE = "£10 for 30 days";

/** The basic directory tier — no longer free, per Rob's call (2026-10): a nominal yearly fee filters low-effort/spam submissions and funds the renewal touchpoint, without pricing anyone out the way a monthly fee would. Featured is unaffected by this change. */
export const STANDARD_LISTING_PRICE = "£2.50/year";

/** "2026-11-14" → "14 November 2026" (paid-until dates from the checkout). */
export function formatUntil(date?: string): string {
  if (!date) return "";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
