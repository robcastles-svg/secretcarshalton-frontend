import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { BLUE_AD_TIERS, EVENT_UPGRADE_PRICE, FEATURED_DIRECTORY_TIERS, GROUP_PROMOTION_PRICE, JOB_RATE_BRACKETS } from "@/lib/pricing";
import { SOCIAL_REACH_BLURB } from "@/lib/socialStats";
import { AdPreview } from "./_components/AdPreview";
import { SubmitAdForm } from "./_components/SubmitAdForm";

const TITLE = "Advertise on Secret Carshalton";
const DESCRIPTION =
  "Reach a local, engaged Carshalton audience — self-serve text ads, a featured directory listing, featured events, paid job posts, and community group promotion.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const JUMP_LINKS = [
  { href: "#blue-ads", label: "Blue Ads" },
  { href: "#featured", label: "Featured Directory" },
  { href: "#events", label: "Events" },
  { href: "#jobs", label: "Jobs" },
  { href: "#community", label: "Community Groups" },
];

export default async function AdvertisePage() {
  const token = await getSessionToken();

  return (
    <main className="adv-page">
      {/* Hero */}
      <section className="adv-hero">
        <div className="adv-hero-inner">
          <div className="adv-hero-copy">
            <span className="adv-eyebrow adv-eyebrow-gold">Advertising &amp; Promotion</span>
            <h1 className="adv-hero-title">Instant Ads from £2.50</h1>
            <p className="adv-hero-subtitle">No design required — make your own text ads. Subject to approval.</p>
            <div className="adv-hero-ctas">
              <a href="#blue-ads" className="button-pill adv-btn-gold">
                Create a Blue Ad
              </a>
              <a href="#featured" className="button-pill adv-btn-outline-light">
                See Featured packages
              </a>
            </div>
            <nav className="adv-jump" aria-label="Jump to section">
              {JUMP_LINKS.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="adv-hero-example">
            <span className="adv-hero-example-label">Example Blue Ad</span>
            <AdPreview headline="" body="" imageUrl={null} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="adv-how">
        <div className="adv-how-inner">
          <div className="adv-how-step">
            <span className="adv-how-number">1</span>
            <div>
              <div className="adv-how-title">Choose a package</div>
              <div className="adv-how-text">Pick what suits you — from a single day to a monthly listing.</div>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">2</span>
            <div>
              <div className="adv-how-title">Fill in a short form &amp; pay</div>
              <div className="adv-how-text">We only ask for what that package needs.</div>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">3</span>
            <div>
              <div className="adv-how-title">Approved &amp; live</div>
              <div className="adv-how-text">Once approved it goes live on your start date and expires automatically.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Blue Ads */}
      <section id="blue-ads" className="adv-section">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Blue Ads</span>
          <h2 className="adv-h2">Your own text ad, live in minutes</h2>
          <p className="adv-lede">
            A simple, low-cost way to promote your business, event or service. Write it yourself, choose your
            dates, and we&apos;ll approve it.
          </p>
        </div>
        <div className="adv-card-grid">
          <div className="adv-card">
            <div className="adv-card-head">
              <h3 className="adv-card-title">{BLUE_AD_TIERS[0].label}</h3>
              <div className="adv-card-price-row">
                <span className="adv-price">£{BLUE_AD_TIERS[0].pricePerDay.toFixed(2)}</span>
                <span className="adv-per">per day</span>
              </div>
            </div>
            <p className="adv-card-text">A simple, low-cost way to promote your business, event or service.</p>
            <ul className="adv-ticks">
              <li>Create your own text advert</li>
              <li>No design required</li>
              <li>Sidebar placement</li>
              <li>Choose your start date</li>
              <li>Discounts available for 10+ bookings</li>
              <li className="adv-tick-muted">Subject to approval</li>
              <li className="adv-tick-muted">Views are not guaranteed</li>
            </ul>
          </div>
          <div className="adv-card adv-card-highlight">
            <div className="adv-card-head adv-card-head-split">
              <div>
                <h3 className="adv-card-title">{BLUE_AD_TIERS[1].label}</h3>
                <div className="adv-card-price-row">
                  <span className="adv-price">£{BLUE_AD_TIERS[1].pricePerDay.toFixed(2)}</span>
                  <span className="adv-per">per day</span>
                </div>
              </div>
              <span className="adv-pill">Just 50p more</span>
            </div>
            <p className="adv-card-text">More prominent placement for just 50p more.</p>
            <ul className="adv-ticks">
              <li>Create your own text advert</li>
              <li>No design required</li>
              <li>Sidebar placement</li>
              <li>
                <strong>Additional placement within articles and features</strong>
              </li>
              <li>Choose your start date</li>
              <li>Discounts available for 10+ bookings</li>
              <li className="adv-tick-muted">Subject to approval</li>
              <li className="adv-tick-muted">Views are not guaranteed</li>
            </ul>
          </div>
        </div>

        {token ? (
          <div className="adv-inline-form">
            <h3 className="adv-card-title">Build your ad</h3>
            <SubmitAdForm />
          </div>
        ) : (
          <div className="adv-cta-box">
            <Link href="/login?next=/advertise" className="button-pill">
              Sign in to build your ad
            </Link>
            <p className="dashboard-hint">
              Free to join — <Link href="/register">create an account</Link> if you don&apos;t have one.
            </p>
          </div>
        )}
      </section>

      {/* Featured Directory */}
      <section id="featured" className="adv-section">
        <div className="adv-section-intro adv-section-intro-wide">
          <span className="adv-eyebrow">Featured Directory</span>
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
            <Link href="/dashboard/upgrade" className="button-pill button-pill-secondary adv-card-cta">
              Get Featured
            </Link>
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
            <Link href="/dashboard/upgrade" className="button-pill button-pill-secondary adv-card-cta">
              Choose 6 months
            </Link>
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
              <li>One Premium Blue Ad</li>
              <li>Designed banner</li>
              <li>Banner displayed across the site</li>
              <li>Social Story promotion</li>
              <li>Choose your start date within a 2-week window</li>
              <li>Choose how many months you want to run</li>
            </ul>
            <Link href="/dashboard/upgrade" className="button-pill adv-card-cta">
              Choose Featured Plus
            </Link>
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
              <li>One Premium Blue Ad</li>
              <li>Designed banner displayed across the site</li>
              <li>Written article about your business, organisation or event</li>
              <li>Social media post promoting the article</li>
              <li>Choose your start date within a 2-week window</li>
              <li>Choose how many months you want to run</li>
            </ul>
            <Link href="/dashboard/upgrade" className="button-pill adv-btn-gold adv-card-cta">
              Choose Featured Gold
            </Link>
          </div>
        </div>
        <p className="adv-footnote-inline">
          A mention in our Facebook/Instagram stories on Featured Plus and Gold — we reach {SOCIAL_REACH_BLURB}.
        </p>
      </section>

      {/* Events, Jobs, Community */}
      <section className="adv-section">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Events, Jobs &amp; Community</span>
          <h2 className="adv-h2">A boost when it matters</h2>
          <p className="adv-lede">
            Listing events and community groups stays free. Upgrade when you want more people to see it.
          </p>
        </div>
        <div className="adv-card-grid">
          <div id="events" className="adv-card">
            <span className="adv-eyebrow">Event Promotion</span>
            <div className="adv-card-head">
              <h3 className="adv-card-title">Event Listing Upgrade</h3>
              <div className="adv-card-price-row">
                <span className="adv-price">£5</span>
                <span className="adv-per">per event</span>
              </div>
            </div>
            <p className="adv-card-text">Give your event extra visibility when it matters most.</p>
            <ul className="adv-ticks">
              <li>Your event moved to the top of the event listings</li>
              <li>Increased visibility within the Events section</li>
              <li>Ideal for events that need an extra boost</li>
              <li>Upgrade can be purchased for individual events</li>
            </ul>
            <Link href="/events/submit" className="button-pill adv-card-cta">
              Submit an event
            </Link>
            <p className="adv-card-footnote">
              Free listing — add the {EVENT_UPGRADE_PRICE} upgrade from your dashboard once it&apos;s live.
            </p>
          </div>

          <div id="jobs" className="adv-card">
            <span className="adv-eyebrow">Jobs</span>
            <div className="adv-card-head">
              <h3 className="adv-card-title">Job Post</h3>
              <div className="adv-card-price-row">
                <span className="adv-per">from</span>
                <span className="adv-price">{JOB_RATE_BRACKETS[0].price}</span>
                <span className="adv-per">for 7 days</span>
              </div>
            </div>
            <p className="adv-card-text">Priced by the hourly rate of the job.</p>
            <div className="adv-rate-table">
              {JOB_RATE_BRACKETS.map((b) => (
                <div key={b.slug} className="adv-rate-row">
                  <span>{b.label}</span>
                  <strong>{b.price}</strong>
                </div>
              ))}
            </div>
            <ul className="adv-ticks">
              <li>Job advertised for 7 days</li>
              <li>Placed at the top of the jobs feed</li>
              <li>Visible for the full 7-day period</li>
              <li>Automatic expiry — no need to remember to remove it</li>
            </ul>
            <Link href="/jobs/submit" className="button-pill adv-card-cta">
              Post a job
            </Link>
          </div>

          <div id="community" className="adv-card">
            <span className="adv-eyebrow">Community Groups</span>
            <div className="adv-card-head">
              <h3 className="adv-card-title">Community Group Promotion</h3>
              <div className="adv-card-price-row">
                <span className="adv-price">£10</span>
                <span className="adv-per">for 30 days</span>
              </div>
            </div>
            <p className="adv-card-text">
              A low-cost way for local groups to promote themselves to the Secret Carshalton community.
            </p>
            <ul className="adv-ticks">
              <li>Featured placement within the Community section</li>
              <li>Group name and description</li>
              <li>Photo or group image</li>
              <li>Website, Facebook or other social link</li>
              <li>More visibility than a standard community listing</li>
              <li>30-day promotion</li>
            </ul>
            <div className="adv-note-box">
              Local community groups can still be listed in the Community section <strong>for free</strong>. This
              is an optional upgrade for extra visibility — once your group&apos;s listed, request promotion from
              its page.
            </div>
            <Link href="/directory/submit" className="button-pill adv-card-cta">
              Submit your group
            </Link>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <section className="adv-section adv-closing">
        <div className="adv-member-banner">
          <div>
            <h3 className="adv-h3">Already a member?</h3>
            <p className="adv-card-text">
              Everything you submit or buy appears in your dashboard — dates, approval status and renewals in
              one place.
            </p>
          </div>
          <Link href="/dashboard" className="button-pill">
            Go to my dashboard
          </Link>
        </div>
        <p className="adv-disclaimer">
          * Exposure figures are estimates based on typical Secret Carshalton traffic and are not guaranteed.
          Actual exposure may vary depending on website traffic, content, seasonality and other factors.
        </p>
      </section>
    </main>
  );
}
