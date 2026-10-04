import Link from "next/link";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { getDirectoryCategories, getDirectoryListingBySlug, getMyListings, type WPListing } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { SubmitListingForm } from "./_components/SubmitListingForm";

export const metadata = { title: "Add a free listing — Secret Carshalton" };

/** A real, live listing — Rob's choice, not a fabricated example — so the category badges on the preview card below are genuine. Only its categories are borrowed; the title/content shown is the generic placeholder below. */
const EXAMPLE_SLUG = "rcb-plumbing-ltd-boiler-servicing-repairs-heating-specialists";

/**
 * The Free listing one-pager — mirrors /jobs/manager's structure (hero,
 * brief explainer, form, all on one page) but in --ad-blue rather than
 * --ad-navy, so it still reads as distinct from /directory/featured (the
 * Premium equivalent, in navy) without the full-strength pink Rob tried
 * first and found too loud. The two pages link to each other via the
 * toggle button under the headline, and DirectoryBrowse's directory page
 * links to both directly.
 *
 * No redirect for signed-out visitors (unlike the old combined page this
 * replaces) — same as /jobs/manager, the hero/explainer/preview are
 * worth showing either way, with the form swapped for a sign-in CTA box.
 */
export default async function DirectorySubmitPage() {
  const token = await getSessionToken();

  const [categories, exampleListing, myListings] = await Promise.all([
    getDirectoryCategories().catch(() => []),
    getDirectoryListingBySlug(EXAMPLE_SLUG).catch(() => null),
    token ? getMyListings(token).catch(() => []) : Promise.resolve([]),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const exampleCategoriesList = exampleListing?.sc_listing_category
    ?.map((id) => categoriesById.get(id))
    .filter((c): c is (typeof categories)[number] => Boolean(c));

  // The free tier's actual shape (see SubmitListingForm) — title, website
  // and one category, nothing else. A generic placeholder name, not a
  // real business, so this reads as "here's the shape" rather than
  // singling anyone out.
  const previewListing: WPListing = {
    id: -1,
    slug: "",
    link: "",
    date: new Date().toISOString(),
    title: { rendered: "Your Business Name" },
    content: { rendered: "" },
    author: 0,
    sc_listing_category: exampleListing?.sc_listing_category ?? [],
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
    <main className="adv-page">
      {/* Hero */}
      <section className="adv-hero adv-hero-blue">
        <div className="adv-hero-inner">
          <div className="adv-hero-copy">
            <span className="adv-eyebrow adv-eyebrow-gold">Directory</span>
            <h1 className="adv-hero-title">Get started. Free listing.</h1>
            <p className="adv-hero-subtitle">
              Add your business, organisation or community group to the Sutton Business Directory — free, reviewed
              before it goes live, and yours to manage from your dashboard any time.
            </p>
            <div className="adv-hero-ctas">
              <a href="#add-listing" className="button-pill adv-btn-gold">
                Add your free listing
              </a>
              <Link href="/directory/featured" className="button-pill adv-btn-outline-light">
                Premium listing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="adv-how">
        <div className="adv-how-inner">
          <div className="adv-how-step">
            <span className="adv-how-number">1</span>
            <div>
              <p className="adv-how-title">Listed for free</p>
              <p className="adv-how-text">Your name, website and category, found by anyone browsing the directory.</p>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">2</span>
            <div>
              <p className="adv-how-title">Reviewed, not instant</p>
              <p className="adv-how-text">We check listings before they go live — usually within a day or two.</p>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">3</span>
            <div>
              <p className="adv-how-title">Upgrade any time</p>
              <p className="adv-how-text">
                Manage it from your dashboard, or go <Link href="/directory/featured">Featured</Link> later for more reach.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="adv-section">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Preview</span>
          <h2 className="adv-h2">How it looks in the directory</h2>
          <p className="adv-lede">Your free listing shows up in the grid just like this.</p>
        </div>
        <ul className="post-list directory-list">
          <DirectoryListingCard listing={previewListing} categoriesList={exampleCategoriesList} />
        </ul>
      </section>

      {/* Form */}
      <section id="add-listing" className="adv-section adv-closing">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Add your listing</span>
          <h2 className="adv-h2">Add your free listing</h2>
        </div>

        {token ? (
          <div className="adv-inline-form">
            <h3 className="adv-card-title">Your details</h3>
            <SubmitListingForm categories={categories} mode="free" />
          </div>
        ) : (
          <div className="adv-cta-box">
            <Link href="/login?next=/directory/submit" className="button-pill">
              Sign in to add your listing
            </Link>
            <p className="dashboard-hint">
              New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
            </p>
          </div>
        )}

        {myListings.length > 0 && (
          <p className="dashboard-hint">
            Already have a listing? <Link href="/dashboard/upgrade">Upgrade it to Featured</Link> from your
            dashboard instead of adding a new one.
          </p>
        )}
      </section>
    </main>
  );
}
