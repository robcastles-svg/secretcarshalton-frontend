import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { isFinished } from "@/lib/event-view";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import { getMyEvents, type WPScEvent } from "@/lib/wordpress";
import { ChevronIcon } from "../../_components/EvIcons";
import { FeatureEventPay } from "../../_components/FeatureEventPay";

export const metadata = { title: "Feature your event — Secret Carshalton" };

/**
 * Pay to feature one of your events (Stage 5): £5 through the site's
 * existing PayPal setup, single upcoming events only, featured until the
 * event's date. The dashboard links here; the add-event page's pop-up,
 * "Your live events" and the edit page offer the same payment in place.
 */
export default async function FeatureEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect(`/login?next=/events/${slug}/feature`);

  // /mine is already scoped to events this member owns — the same
  // boundary the payment routes enforce server-side.
  const events = await getMyEvents(token);
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();
  if (event.status !== "publish") redirect("/dashboard");

  const shape = { meta: { sc_start: event.start, sc_end: "", sc_repeat_dates: event.repeatDates ?? [] } } as unknown as WPScEvent;
  const price = EVENT_UPGRADE_PRICE.split(" ")[0];

  let body;
  if (event.featured) body = <p className="evf-msg evf-msg-ok">This event is already featured until its date.</p>;
  else if (event.repeating) body = <p className="evf-hint">Featuring is for single events, not repeating ones.</p>;
  else if (isFinished(shape)) body = <p className="evf-hint">This event has already happened, so it can&apos;t be featured.</p>;
  else
    body = (
      <div className="evf-upgrade">
        <h3>Get more people to see it</h3>
        <p>
          Your event goes to the top of the events list and into the rotating highlight on the homepage, until the
          event date.
        </p>
        <div className="evf-cost">
          {price} <span>one-off payment</span>
        </div>
        <FeatureEventPay eventId={event.id} />
      </div>
    );

  return (
    <main className="evx evf-page">
      <div className="evx-crumb">
        <Link href={`/events/${event.slug}`} className="evx-back">
          <ChevronIcon />
          Back to event
        </Link>
      </div>
      <div className="evx-layout evf-feature-page">
        <div className="evf-main">
          <section className="evf-intro">
            <h1>Feature your event</h1>
            <p>{event.title}</p>
          </section>
          <section className="evf-sec">{body}</section>
        </div>
      </div>
    </main>
  );
}
