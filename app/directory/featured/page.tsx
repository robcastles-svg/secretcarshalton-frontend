import Link from "next/link";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { getSessionToken } from "@/lib/auth";
import { FEATURED_DIRECTORY_TIERS } from "@/lib/pricing";
import { SOCIAL_REACH_BLURB } from "@/lib/socialStats";
import { getDirectoryCategories, getDirectoryListingBySlug, getMyListings } from "@/lib/wordpress";
import { SubmitListingForm } from "../submit/_components/SubmitListingForm";

export const metadata = { title: "Featured directory listing — Secret Carshalton" };

/** A real, live Featured listing — Rob's choice, not a fabricated example — so the preview below shows the actual card, not an approximation of one. */
const FEATURED_EXAMPLE_SLUG = "rcb-plumbing-ltd-boiler-servicing-repairs-heating-specialists";

/**
 * The Premium listing one-pager — same structure as /advertise (navy
 * hero, "clean coloured boxes" for the packages, form below), distinct
 * from /directory/submit's --ad-blue free-page hero. The four tier cards
 * mirror /advertise's Featured Directory section (same copy, same card
 * treatment) so the two surfaces read as one system — info only, no CTA
 * button per card, since there's one form below, not four separate
 * sign-up paths. Its package is picked via a dropdown in that form
 * (SubmitListingForm, mode="featured"), pre-selectable via ?tier= (see
 * /advertise's links here) rather than per-card buttons.
 */
export default async function FeaturedListingPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;
  const token = await getSessionToken();

  const [categories, featuredListing, myListings] = await Promise.all([
    getDirectoryCategories().catch(() => []),
    getDirectoryListingBySlug(FEATURED_EXAMPLE_SLUG).catch(() => null),
    token ? getMyListings(token).catch(() => []) : Promise.resolve([]),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const featuredCategoriesList = featuredListing?.sc_listing_category
    ?.map((id) => categoriesById.get(id))
    .filter((c): c is (typeof categories)[number] => Boolean(c));

  return (
    <main className="adv-page">
      {/* Hero */}
      <section className="adv-hero">
        <div className="adv-hero-inner">
          <div className="adv-hero-copy">
            <span className="adv-eyebrow adv-eyebrow-gold">Directory</span>
            <h1 className="adv-hero-title">Get more exposure. Go Featured.</h1>
            <p className="adv-hero-subtitle">
              A full profile with photos, map and links — plus top placement in your category. From £50/month,
              reviewed before it goes live.
            </p>
            <div className="adv-hero-ctas">
              <a href="#packages" className="button-pill adv-btn-gold">
                See packages
              </a>
              <Link href="/directory/submit" className="button-pill adv-btn-outline-light">
                Free listing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="adv-section">
        <div className="adv-section-intro adv-section-intro-wide">
          <span className="adv-eyebrow">Packages</span>
          <h2 className="adv-h2">Put your business in front of Carshalton</h2>
          <p className="adv-lede">
            A proper directory listing with photos, map and links — plus, on Plus and Gold, a designed banner,
            social promotion and editorial coverage from the Secret Carshalton team.
          </p>
        </div>
        <div className="adv-card-grid adv-card-grid-4">
          <div className="adv-card">
            <div className="adv-card-head">
              <h3 className="adv-card-title">{FEATURED_DIRECTORY_TIERS[0].label}</h3>
              <div className="adv-card-price-row">
                <span className="adv-price">{FEATURED_DIRECTORY_TIERS[0].price}</span>
                <span className="adv-per">{FEATURED_DIRECTORY_TIERS[0].per}</span>
              </div>
            </div>
            <span className="adv-pill">{FEATURED_DIRECTORY_TIERS[0].exposureNote}</span>
            <p className="adv-card-text">A prominent directory listing with exposure within the relevant category.</p>
            <ul className="adv-ticks">
              <li>Up to 3 photos</li>
              <li>Title, description &amp; tagline</li>
              <li>Website URL &amp; address</li>
              <li>Social media links</li>
              <li>Map location</li>
              <li>Featured directory listing</li>
              <li>Prominent exposure within your category</li>
              <li>Category image displayed across the site</li>
            </ul>
          </div>

          <div className="adv-card">
            <div className="adv-card-head">
              <h3 className="adv-card-title">{FEATURED_DIRECTORY_TIERS[1].label}</h3>
              <div className="adv-card-price-row">
                <span className="adv-price">{FEATURED_DIRECTORY_TIERS[1].price}</span>
                <span className="adv-per">{FEATURED_DIRECTORY_TIERS[1].per}</span>
              </div>
            </div>
            <span className="adv-pill adv-pill-green">{FEATURED_DIRECTORY_TIERS[1].exposureNote}</span>
            <p className="adv-card-text">Our discounted longer-term Featured option.</p>
            <ul className="adv-ticks">
              <li>Est. 50+ monthly exposure*</li>
              <li>Six-month listing</li>
              <li>All Featured benefits</li>
            </ul>
          </div>

          <div className="adv-card adv-card-highlight">
            <div className="adv-card-head">
              <h3 className="adv-card-title">{FEATURED_DIRECTORY_TIERS[2].label}</h3>
              <div className="adv-card-price-row">
                <span className="adv-price">{FEATURED_DIRECTORY_TIERS[2].price}</span>
                <span className="adv-per">{FEATURED_DIRECTORY_TIERS[2].per}</span>
              </div>
            </div>
            <span className="adv-pill">{FEATURED_DIRECTORY_TIERS[2].exposureNote}</span>
            <p className="adv-card-text">A Featured listing combined with additional advertising and social promotion.</p>
            <ul className="adv-ticks">
              <li>
                <strong>Everything in Featured</strong>
              </li>
              <li>One Premium Text Ad</li>
              <li>Designed banner</li>
              <li>Banner displayed across the site</li>
              <li>Social Story promotion</li>
              <li>Choose your start date within a 2-week window</li>
              <li>Choose how many months you want to run</li>
            </ul>
          </div>

          <div className="adv-card adv-card-dark">
            <div className="adv-card-head">
              <span className="adv-eyebrow adv-eyebrow-gold">Highest level of promotion</span>
              <h3 className="adv-card-title adv-card-title-light">{FEATURED_DIRECTORY_TIERS[3].label}</h3>
              <div className="adv-card-price-row">
                <span className="adv-price adv-price-light">{FEATURED_DIRECTORY_TIERS[3].price}</span>
                <span className="adv-per adv-per-light">{FEATURED_DIRECTORY_TIERS[3].per}</span>
              </div>
            </div>
            <span className="adv-pill adv-pill-gold">{FEATURED_DIRECTORY_TIERS[3].exposureNote}</span>
            <p className="adv-card-text adv-card-text-light">
              A Featured listing, advertising and editorial coverage combined.
            </p>
            <ul className="adv-ticks adv-ticks-dark">
              <li>
                <strong>Everything in Featured Plus</strong>
              </li>
              <li>One Premium Text Ad</li>
              <li>Designed banner displayed across the site</li>
              <li>Written article about your business, organisation or event</li>
              <li>Social media post promoting the article</li>
              <li>Choose your start date within a 2-week window</li>
              <li>Choose how many months you want to run</li>
            </ul>
          </div>
        </div>
        <p className="adv-footnote-inline">
          A mention in our Facebook/Instagram stories on Featured Plus and Gold — we reach {SOCIAL_REACH_BLURB}.
        </p>
      </section>

      {/* Preview */}
      {featuredListing && (
        <section className="adv-section">
          <div className="adv-section-intro">
            <span className="adv-eyebrow">Preview</span>
            <h2 className="adv-h2">How a Featured listing looks</h2>
            <p className="adv-lede">A real Featured listing, exactly as it appears in the directory grid.</p>
          </div>
          <ul className="post-list directory-list">
            <DirectoryListingCard listing={featuredListing} categoriesList={featuredCategoriesList} />
          </ul>
        </section>
      )}

      {/* Form */}
      <section id="add-listing" className="adv-section adv-closing">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Add your listing</span>
          <h2 className="adv-h2">Add your Featured listing</h2>
          <p className="adv-lede">
            There&apos;s no automated payment yet — submit this and we&apos;ll be in touch to arrange it (PayPal).
            Nothing is charged now.
          </p>
        </div>

        {token ? (
          <div className="adv-inline-form">
            <h3 className="adv-card-title">Your details</h3>
            <SubmitListingForm categories={categories} mode="featured" initialTier={tier} />
          </div>
        ) : (
          <div className="adv-cta-box">
            <Link href={`/login?next=${encodeURIComponent(tier ? `/directory/featured?tier=${tier}` : "/directory/featured")}`} className="button-pill">
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
