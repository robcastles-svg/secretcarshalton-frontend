import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { getOccurrences, upcomingOccurrences, dateParts } from "@/lib/event-view";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import {
  getEventVenues,
  getMemberMe,
  getMyEvents,
  getMyOrganizers,
  getScEventCategories,
  getScEventTags,
  type WPScEvent,
} from "@/lib/wordpress";
import { HIDDEN_TOPICS } from "@/lib/event-list";
import { ChevronIcon } from "../_components/EvIcons";
import { EventForm } from "../_components/EventForm";
import { LiveEventsPanel, type LiveEventRow } from "./_components/LiveEventsPanel";

export const metadata = { title: "Add your event — Secret Carshalton" };

/**
 * Logged-in members get the new "Add your event" page (events redesign,
 * Stage 4): one white panel with the title, intro, tip, "Your live
 * events" and the form, plus a live preview and the Submit button.
 * Logged-out visitors keep the existing page (hero, how-it-works, sign-in
 * box), unchanged apart from the form being for members only anyway.
 */
export default async function EventsSubmitPage() {
  const token = await getSessionToken();
  if (token) return <AddYourEventPage token={token} />;
  return <LoggedOutSubmitPage />;
}

async function AddYourEventPage({ token }: { token: string }) {
  const [profile, areas, tags, venues, organizers, mine] = await Promise.all([
    getMemberMe(token),
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getEventVenues().catch(() => []),
    getMyOrganizers(token),
    getMyEvents(token),
  ]);

  // "Your live events": published events that haven't finished yet.
  const now = Date.now();
  const live: LiveEventRow[] = mine
    .filter((e) => e.status === "publish")
    .map((e) => {
      const shape = { meta: { sc_start: e.start, sc_end: "", sc_repeat_dates: e.repeatDates ?? [] } } as unknown as WPScEvent;
      const next = upcomingOccurrences(shape, now)[0];
      const count = getOccurrences(shape).length;
      return { e, next, count };
    })
    .filter((x) => x.next)
    .sort((a, b) => a.next!.start.getTime() - b.next!.start.getTime())
    .map(({ e, next, count }) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      dateLabel:
        dateParts(next!.start).label.replace(/ \d{4}$/, "") + (e.repeating ? ` · ${count} dates` : ""),
      thumbnail: e.thumbnail ?? "",
      views: e.views,
      featured: e.featured,
      repeating: Boolean(e.repeating),
    }));

  return (
    <main className="evx evf-page">
      <div className="evx-crumb">
        <Link href="/events" className="evx-back">
          <ChevronIcon />
          View all events
        </Link>
      </div>
      <EventForm
        mode="create"
        areas={areas}
        topics={tags.filter((t) => !HIDDEN_TOPICS.has(t.slug))}
        venues={venues}
        organizers={organizers}
        memberName={profile?.display_name ?? ""}
        header={
          <>
            <section className="evf-intro">
              <h1>Add your event</h1>
              <p>Adding an event is free. It goes live as soon as you submit it, and you can edit it any time.</p>
              <div className="evf-tip">
                Tip: sharing an event at least a month in advance is the most successful way to gain views.
              </div>
            </section>
            <LiveEventsPanel events={live} />
          </>
        }
      />
    </main>
  );
}

/** The existing page for visitors who aren't signed in — hero, how-it-works and the sign-in box. */
function LoggedOutSubmitPage() {
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

        <div className="adv-cta-box">
            <Link href="/login?next=/events/submit" className="button-pill">
              Sign in to add your event
            </Link>
            <p className="dashboard-hint">
              New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
            </p>
          </div>
      </section>
    </main>
  );
}
