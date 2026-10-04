import Link from "next/link";
import { redirect } from "next/navigation";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { FEATURED_DIRECTORY_TIERS } from "@/lib/pricing";
import { SOCIAL_REACH_BLURB } from "@/lib/socialStats";
import { getDirectoryCategories, getDirectoryListingBySlug, getMyListings, type WPListing } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { SubmitListingForm } from "./_components/SubmitListingForm";

export const metadata = { title: "Add a listing — Secret Carshalton" };

/** A real, live featured listing — Rob's choice, not a fabricated example — so the comparison below shows the actual card, not an approximation of one. */
const FEATURED_EXAMPLE_SLUG = "rcb-plumbing-ltd-boiler-servicing-repairs-heating-specialists";

/**
 * The one page for adding a directory listing — free or any Featured
 * tier, picked in the same form rather than a separate trip to
 * /dashboard/upgrade later (that page still exists, but now only for
 * upgrading a listing you already have — see its own redirect when you
 * have none). Replaces the old split between this page (free-only) and
 * /directory/featured (a standalone sales/comparison page); that
 * comparison content now lives here, right above the form.
 */
export default async function DirectorySubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;

  const token = await getSessionToken();
  if (!token) redirect(tier ? `/directory/manager?tier=${encodeURIComponent(tier)}` : "/directory/manager");

  const initialTier = FEATURED_DIRECTORY_TIERS.find((t) => t.slug === tier)?.slug ?? "free";

  const [categories, featuredListing, myListings] = await Promise.all([
    getDirectoryCategories().catch(() => []),
    getDirectoryListingBySlug(FEATURED_EXAMPLE_SLUG).catch(() => null),
    getMyListings(token),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const featuredCategoriesList = featuredListing?.sc_listing_category
    ?.map((id) => categoriesById.get(id))
    .filter((c): c is (typeof categories)[number] => Boolean(c));

  // The free tier's actual shape (see SubmitListingForm) — title, website
  // and one category, nothing else. No real free listing is singled out
  // here, just that shape, so the comparison is "tier vs. tier" rather
  // than naming a specific business as the lesser option.
  const freeExampleListing: WPListing = {
    id: -1,
    slug: "",
    link: "",
    date: new Date().toISOString(),
    title: { rendered: "Your Business Name" },
    content: { rendered: "" },
    author: 0,
    sc_listing_category: featuredListing?.sc_listing_category ?? [],
    meta: {
      sc_address_street: "",
      sc_address_town: "",
      sc_address_region: "",
      sc_address_postcode: "",
      sc_address_country: "",
      sc_website: "",
      sc_phone: "",
      sc_email: "",
      sc_tagline: "",
      sc_facebook: "",
      sc_instagram: "",
      sc_twitter: "",
      sc_linkedin: "",
      sc_youtube: "",
      sc_lat: "",
      sc_lng: "",
      sc_featured: false,
      sc_verified: false,
      sc_claimed: false,
      sc_plan: "",
      sc_claim_expires_at: "",
      sc_featured_tier: "",
      sc_group_promoted: false,
      sc_group_promo_expires_at: "",
    },
  };

  return (
    <main className="container auth-page directory-featured-page">
      <h1>Add a listing</h1>
      <p>
        Own or run a local business, organisation or community group? Add it here — it&apos;s free, and you can
        optionally go Featured in the same step below for more visibility. Listings are reviewed before they go
        live.
      </p>

      {myListings.length > 0 && (
        <p className="dashboard-hint">
          Already have a listing? <Link href="/dashboard/upgrade">Upgrade it to Featured</Link> from your
          dashboard instead of adding a new one.
        </p>
      )}

      {featuredListing && (
        <>
          <h2 className="directory-compare-heading">Free vs. Featured</h2>
          <ul className="event-manager-benefits">
            <li>Around 150 views a month from your category pages alone, on Featured</li>
            <li>Featured ranks above every free listing in its category</li>
            <li>A mention in our Facebook/Instagram stories on Featured Plus and Gold — we reach {SOCIAL_REACH_BLURB}</li>
          </ul>
          <div className="directory-compare-grid">
            <div>
              <span className="theme-eyebrow">Free listing</span>
              <ul className="post-list">
                <DirectoryListingCard listing={freeExampleListing} categoriesList={featuredCategoriesList} />
              </ul>
            </div>
            <div>
              <span className="theme-eyebrow">Featured listing</span>
              <ul className="post-list">
                <DirectoryListingCard listing={featuredListing} categoriesList={featuredCategoriesList} />
              </ul>
            </div>
          </div>
        </>
      )}

      <SubmitListingForm categories={categories} initialTier={initialTier} />
    </main>
  );
}
