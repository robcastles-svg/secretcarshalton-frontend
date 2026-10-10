import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import { getEventOrganizers, getEventVenues, getMyListings, getScEventCategories, getScEventTags } from "@/lib/wordpress";
import { EventForm } from "../_components/EventForm";

export const metadata = { title: "Add your event — Secret Carshalton" };

/**
 * One page (hero, how-it-works, form), styled like /directory/submit
 * rather than the old two-step flow (a separate /events/manager explainer
 * that /events/submit redirected logged-out visitors to). No redirect for
 * signed-out visitors — the hero/how-it-works are worth showing either
 * way, with the form swapped for a sign-in CTA box, same as every other
 * "add X" page now works.
 */
export default async function EventsSubmitPage() {
  const token = await getSessionToken();

  const [categories, tags, venues, organizers, listings] = await Promise.all([
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getEventVenues().catch(() => []),
    getEventOrganizers().catch(() => []),
    token ? getMyListings(token).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <main className="adv-page">
      {/* Hero */}
      <section className="adv-hero adv-hero-blue">
        <div className="adv-hero-inner">
          <div className="adv-hero-copy">
            <span className="adv-eyebrow adv-eyebrow-gold">Events</span>
            <h1 className="adv-hero-title">Add events for free.</h1>
            <p className="adv-hero-subtitle">
              Reach hundreds of people looking to see what&apos;s on. Your event goes live as soon as you add it, and
              it&apos;s yours to manage from your dashboard any time. Optional — promote it to the top of the list for{" "}
              {EVENT_UPGRADE_PRICE}, any time after it&apos;s live.
            </p>
            <div className="adv-hero-ctas">
              <a href="#add-event" className="button-pill adv-btn-gold">
                Add your event
              </a>
              <Link href="/events" className="button-pill adv-btn-outline-light">
                See what&apos;s on →
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
              <p className="adv-how-title">Completely free</p>
              <p className="adv-how-text">Title, date, location and description — found by anyone browsing what&apos;s on.</p>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">2</span>
            <div>
              <p className="adv-how-title">Live straight away</p>
              <p className="adv-how-text">
                Your event appears on the site as soon as you add it, and you can edit it any time. Newly-added events
                get shared on our Facebook and Instagram stories.
              </p>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">3</span>
            <div>
              <p className="adv-how-title">Optional upgrade — {EVENT_UPGRADE_PRICE}</p>
              <p className="adv-how-text">
                Manage it yourself from your dashboard any time, or promote it to the top of the list for{" "}
                {EVENT_UPGRADE_PRICE} once it&apos;s live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="add-event" className="adv-section adv-closing">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Add your event</span>
          <h2 className="adv-h2">Add your event</h2>
          <p className="adv-lede">
            Tip: sharing an event at least a month in advance is the most successful way to gain views.
          </p>
        </div>

        {token ? (
          <div className="adv-inline-form">
            <h3 className="adv-card-title">Your event details</h3>
            <EventForm
              mode="create"
              categories={categories}
              tags={tags}
              listings={listings}
              venues={venues}
              organizers={organizers}
            />
          </div>
        ) : (
          <div className="adv-cta-box">
            <Link href="/login?next=/events/submit" className="button-pill">
              Sign in to add your event
            </Link>
            <p className="dashboard-hint">
              New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
