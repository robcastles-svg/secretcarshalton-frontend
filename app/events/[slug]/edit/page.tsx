import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { HIDDEN_TOPICS } from "@/lib/event-list";
import {
  getEventVenues,
  getFeaturedImage,
  getMemberMe,
  getMyOrganizers,
  getScEventBySlug,
  getScEventCategories,
  getScEventTags,
  htmlToPlainText,
  stripHtml,
} from "@/lib/wordpress";
import { ChevronIcon } from "../../_components/EvIcons";
import { EventForm, type EventFormInitial } from "../../_components/EventForm";
import { FeatureEventPay } from "../../_components/FeatureEventPay";
import { dateParts, displayOccurrence, isFeaturedNow, isFinished, isRepeating } from "@/lib/event-view";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";

export const metadata = { title: "Edit event — Secret Carshalton" };

/** "2026-10-22T19:30:00" → ["2026-10-22", "19:30"]; older EventON values like "2026-5-24T14:30+0:00" are padded. */
function splitDateTime(raw?: string): [string, string] {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{2}))?/.exec(raw ?? "");
  if (!m) return ["", ""];
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const time = m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : "";
  return [date, time === "00:00" ? "" : time];
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect("/login");

  const [event, profile, areas, tags, venues, organizers] = await Promise.all([
    getScEventBySlug(slug).catch(() => null),
    getMemberMe(token),
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getEventVenues().catch(() => []),
    getMyOrganizers(token),
  ]);

  if (!event) notFound();
  if (!profile) redirect("/login");

  // Ownership (or being an admin/editor) is the real security boundary server-side
  // (SC_Events_REST::check_owns_event) — this is just so neither lands on a form
  // that will 403 on submit.
  if (profile.id !== event.author && !profile.is_editor) {
    redirect(`/events/${slug}`);
  }

  const m = event.meta;
  const area = areas.find((c) => event.sc_event_category?.includes(c.id));
  const eventTags = tags.filter((t) => event.sc_event_tag?.includes(t.id));
  const [date, startTime] = splitDateTime(m.sc_start);
  const [, endTime] = splitDateTime(m.sc_end);

  // The event's own organiser stays pickable even if this member doesn't
  // manage it (e.g. an admin editing someone else's event).
  const own = event.sc_event_organizer_profile;
  const organizerOptions = own && !organizers.some((o) => o.id === own.id) ? [own, ...organizers] : organizers;

  const initial: EventFormInitial = {
    title: stripHtml(event.title.rendered),
    description: htmlToPlainText(event.content.rendered),
    date,
    startTime,
    endTime,
    repeatDates: (m.sc_repeat_dates ?? []).map((d) => splitDateTime(d)[0]).filter(Boolean),
    venue_name: m.sc_venue_name ?? "",
    venue_address: m.sc_venue_address ?? "",
    organizer: m.sc_organizer ?? "",
    organizer_id: own ? String(own.id) : "",
    area: area?.slug ?? "",
    topics: eventTags.filter((t) => !HIDDEN_TOPICS.has(t.slug)).map((t) => t.slug),
    otherTags: eventTags.filter((t) => HIDDEN_TOPICS.has(t.slug)).map((t) => t.slug),
    price_type: m.sc_price_type ?? "",
    price_amount: m.sc_price_amount ?? "",
    price_from: Boolean(m.sc_price_from),
    price_concession: m.sc_price_concession ?? "",
    booking_type: m.sc_booking_type ?? "",
    booking_link_kind: m.sc_booking_link_kind ?? "",
    booking_email: m.sc_booking_email ?? "",
    booking_phone: m.sc_booking_phone ?? "",
    event_url: m.sc_event_url ?? "",
    image: getFeaturedImage(event)?.source_url ?? "",
  };

  // "Feature this event" in the side column: single, upcoming events only.
  const featurePrice = EVENT_UPGRADE_PRICE.split(" ")[0];
  const shownDate = displayOccurrence(event);
  const featureCard = isFeaturedNow(event) ? (
    <section className="evf-submit">
      <span className="evf-tag-featured">
        Featured until {shownDate ? dateParts(shownDate.start).label : "event date"}
      </span>
    </section>
  ) : isRepeating(event) ? (
    <section className="evf-submit">
      <p>Featuring is for single events.</p>
    </section>
  ) : !isFinished(event) ? (
    <section className="evf-submit evf-feature-card">
      <h3>Get more people to see it</h3>
      <p>
        Featured events go to the top of the events list and into the rotating highlight on the homepage, until the
        event date.
      </p>
      <div className="evf-cost">
        {featurePrice} <span>one-off payment</span>
      </div>
      <FeatureEventPay eventId={event.id} />
    </section>
  ) : null;

  return (
    <main className="evx evf-page">
      <div className="evx-crumb">
        <Link href={`/events/${event.slug}`} className="evx-back">
          <ChevronIcon />
          Back to event
        </Link>
      </div>
      <EventForm
        mode="edit"
        eventId={event.id}
        eventSlug={event.slug}
        areas={areas}
        topics={tags.filter((t) => !HIDDEN_TOPICS.has(t.slug))}
        venues={venues}
        organizers={organizerOptions}
        memberName={profile.display_name}
        initial={initial}
        sideExtra={featureCard}
        header={
          <section className="evf-intro">
            <h1>Edit your event</h1>
            <p>Changes show on the site as soon as you save them.</p>
          </section>
        }
      />
    </main>
  );
}
