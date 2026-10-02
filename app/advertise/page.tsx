import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { AdPreview } from "./_components/AdPreview";
import { SubmitAdForm } from "./_components/SubmitAdForm";

const TITLE = "Advertise — Secret Carshalton";
const DESCRIPTION =
  "Reach a local, engaged Carshalton audience — self-serve banner ads, featured directory listings, featured events, and paid job posts.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

export default async function AdvertisePage() {
  const token = await getSessionToken();

  return (
    <main className="container advertise-page">
      <div className="advertise-hero">
        <h1>Advertise with Secret Carshalton</h1>
        <p>
          Reach people who actually live in and around Carshalton — readers, local members, and
          people searching for places, events and jobs nearby. A few ways to get seen, from a
          quick self-serve banner to a featured spot.
        </p>
      </div>

      <div className="advertise-products">
        <section id="ads" className="advertise-product advertise-product-ads">
          <h2>Banner ads</h2>
          <p>
            Write your own text ad, choose where it appears — sidebar, in-article, or mixed into
            the story/listing feeds — and it goes live once payment&apos;s confirmed.
          </p>
          <div className="advertise-example">
            <AdPreview
              headline="20% off this month at your shop"
              body="A short line about your offer or business"
              imageUrl={null}
            />
          </div>
          <p className="advertise-price">
            From <strong>£1–£2.50 a day</strong> for the sidebar; in-article costs 50% more, since it&apos;s
            embedded in the article and more likely to be seen.
            <span className="advertise-price-note">
              {" "}
              Holding figures while pricing&apos;s finalised; we&apos;ll confirm the exact amount when
              we&apos;re in touch about payment.
            </span>
          </p>
          {token ? (
            <SubmitAdForm />
          ) : (
            <div className="advertise-cta-box">
              <Link href="/login?next=/advertise" className="button-pill">
                Sign in to build your ad
              </Link>
              <p className="dashboard-hint">
                Free to join — <Link href="/register">create an account</Link> if you don&apos;t
                have one.
              </p>
            </div>
          )}
        </section>

        <section id="directory" className="advertise-product advertise-product-directory">
          <span className="advertise-chip advertise-chip-pink">Featured</span>
          <h2>Featured directory listing</h2>
          <p>
            Upgrade a free business listing to featured — the long-form version with your full
            details, photos and socials, plus a featured spot at the top of your category.
          </p>
          <p className="advertise-price">
            <strong>£10/month</strong>
            <span className="advertise-price-note"> — a monthly subscription, cancel any time.</span>
          </p>
          <div className="advertise-cta-row">
            <Link href="/directory/submit" className="button-pill button-pill-secondary">
              Add a free listing
            </Link>
            <Link href="/dashboard/upgrade" className="button-pill">
              Request the upgrade
            </Link>
          </div>
        </section>

        <section id="events" className="advertise-product advertise-product-events">
          <span className="advertise-chip advertise-chip-pink">Featured</span>
          <h2>Featured event</h2>
          <p>
            Pay to feature your event — it takes over the &quot;Coming up next&quot; spot at the
            top of the Events page until a more recent featured event replaces it.
          </p>
          <p className="advertise-price">
            <span className="advertise-price-note">
              Pricing arranged individually for now — get in touch once your event&apos;s
              submitted.
            </span>
          </p>
          <div className="advertise-cta-row">
            <Link href="/events/submit" className="button-pill button-pill-secondary">
              Submit an event
            </Link>
            <Link href="/dashboard" className="button-pill">
              Feature an existing one
            </Link>
          </div>
        </section>

        <section id="jobs" className="advertise-product advertise-product-jobs">
          <h2>Post a job</h2>
          <p>
            Hiring locally? List your vacancy here — reviewed before it goes live, and seen by
            people actually looking in the area.
          </p>
          <p className="advertise-price">
            <span className="advertise-price-note">
              Pricing arranged individually for now — get in touch once you&apos;ve posted.
            </span>
          </p>
          <div className="advertise-cta-row">
            <Link href="/jobs/submit" className="button-pill">
              Post a job
            </Link>
          </div>
        </section>
      </div>

      <div className="advertise-contact-banner">
        <h2>Questions, or want something bespoke?</h2>
        <p>Get in touch and we&apos;ll sort pricing and details directly.</p>
        <Link href="/contact" className="button-pill button-pill-secondary">
          Contact us
        </Link>
      </div>
    </main>
  );
}
