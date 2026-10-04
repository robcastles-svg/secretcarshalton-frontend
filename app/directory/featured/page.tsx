import Link from "next/link";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { FEATURED_DIRECTORY_TIERS } from "@/lib/pricing";
import { SOCIAL_REACH_BLURB } from "@/lib/socialStats";
import { getDirectoryCategories, getDirectoryListingBySlug, type WPListing } from "@/lib/wordpress";

export const metadata = { title: "Featured directory listing — Secret Carshalton" };

/** A real, live featured listing — Rob's choice, not a fabricated example — so the comparison below shows the actual card, not an approximation of one. */
const FEATURED_EXAMPLE_SLUG = "rcb-plumbing-ltd-boiler-servicing-repairs-heating-specialists";

/**
 * Where the Directory page's main "Add a listing" button sends people,
 * instead of straight to the free listing form — same idea as
 * /events/manager: lead with the benefit of the thing worth paying for,
 * free stays one click away underneath for anyone who just wants that.
 * Business-focused framing specifically — /community/groups/manager is
 * the equivalent page for people adding a free community group instead.
 *
 * The CTA goes straight to /directory/submit (no auth check here) — that
 * page already handles the not-signed-in case on its own (redirects to
 * /directory/manager), so this page doesn't need to duplicate that logic.
 */
export default async function FeaturedListingPage() {
  const [featuredListing, categories] = await Promise.all([
    getDirectoryListingBySlug(FEATURED_EXAMPLE_SLUG).catch(() => null),
    getDirectoryCategories().catch(() => []),
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
    <main className="container auth-page event-manager-page directory-featured-page">
      <h1>Featured directory listing</h1>
      <p>
        The long-form version of a free listing — your full details, photos and socials, plus a featured spot at
        the top of your category on both Directory and Discover. Four packages, from £50/month.
      </p>

      <ul className="event-manager-benefits">
        <li>Around 150 views a month from your category pages alone</li>
        <li>Top ranking, above every free listing in your category</li>
        <li>Featured Plus and Gold add a designed banner, editorial coverage and social promotion</li>
        <li>A mention in our Facebook/Instagram stories on Featured Plus and Gold — we reach {SOCIAL_REACH_BLURB}</li>
      </ul>

      <h2 className="directory-compare-heading">See the difference</h2>
      <div className="directory-compare-grid">
        <div>
          <span className="theme-eyebrow">Free listing</span>
          <ul className="post-list">
            <DirectoryListingCard listing={freeExampleListing} categoriesList={featuredCategoriesList} />
          </ul>
        </div>
        {featuredListing && (
          <div>
            <span className="theme-eyebrow">Featured listing</span>
            <ul className="post-list">
              <DirectoryListingCard listing={featuredListing} categoriesList={featuredCategoriesList} />
            </ul>
          </div>
        )}
      </div>

      {FEATURED_DIRECTORY_TIERS.map((t) => (
        <p key={t.slug} className="advertise-price">
          <strong>{t.label}</strong>
          <span className="advertise-price-note">
            {" "}
            — {t.price} {t.per}
          </span>
        </p>
      ))}

      <div className="advertise-cta-box">
        <Link href="/directory/submit?tier=featured" className="button-pill">
          Get Featured
        </Link>
        <p className="dashboard-hint">
          Just want the basics? <Link href="/directory/submit">Add a free listing</Link> instead.
        </p>
      </div>
    </main>
  );
}
