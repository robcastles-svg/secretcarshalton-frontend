import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { SITE_URL, getOccurrences, upcomingOccurrences, type Occurrence } from "@/lib/event-view";
import { getAd, getFeaturedImage, getScEventsByVenue, stripHtml, type WPScEvent } from "@/lib/wordpress";
import { BackToEvent } from "../../_components/BackToEvent";
import { EventCard } from "../../_components/EventCard";
import { PastEventsList } from "../../_components/PastEventsList";
import { VenueCard } from "../../_components/VenueCard";

export const revalidate = 3600;

type Props = { params: Promise<{ venue: string }> };

/**
 * Splits a venue's events into upcoming (each event once, at its next
 * date — repeating events too — soonest first) and past (newest first),
 * and picks the venue's name and address. The address is taken as-is
 * from the soonest upcoming event, or the most recent past one.
 */
function venueData(events: WPScEvent[], now = Date.now()) {
  const upcoming = events
    .map((event) => ({ event, next: upcomingOccurrences(event, now)[0] }))
    .filter((x): x is { event: WPScEvent; next: Occurrence } => Boolean(x.next))
    .sort((a, b) => a.next.start.getTime() - b.next.start.getTime());
  const past = events
    .filter((e) => upcomingOccurrences(e, now).length === 0)
    .map((event) => ({ event, last: getOccurrences(event).at(-1) }))
    .filter((x): x is { event: WPScEvent; last: Occurrence } => Boolean(x.last))
    .sort((a, b) => b.last.start.getTime() - a.last.start.getTime());
  const source = upcoming[0]?.event ?? past[0]?.event ?? events[0];
  return {
    upcoming,
    past,
    name: source?.meta.sc_venue_name ?? "",
    address: source?.meta.sc_venue_address ?? "",
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { venue } = await params;
  const events = await getScEventsByVenue(venue).catch(() => []);
  if (events.length === 0) return {};
  const { upcoming, name, address } = venueData(events);
  const title = `Events at ${name} – What's On | Secret Carshalton`;
  const description = upcoming.length
    ? `What's on at ${name}${address ? `, ${address}` : ""}: ${upcoming.length} upcoming event${
        upcoming.length === 1 ? "" : "s"
      }, plus past events.`
    : `Events at ${name}${address ? `, ${address}` : ""} on Secret Carshalton.`;
  // Share image: the next event's photo, otherwise the site logo (there's
  // no separate default share image).
  const image =
    upcoming.map((u) => getFeaturedImage(u.event)?.source_url).find(Boolean) ?? `${SITE_URL}/logo.png`;
  const path = `/events/venue/${venue}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE_URL}${path}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/**
 * A venue's page, in the events list pages' black style: back button and
 * breadcrumb, the venue's name and address, its map card, "Coming up"
 * cards and a compact past-events list. Venues aren't stored as their own
 * records — the page gathers every event whose venue name slugifies to
 * this address (see slugifyVenue).
 */
export default async function EventsByVenuePage({ params }: Props) {
  const { venue } = await params;
  const [events, sidebarAd1, sidebarAd2, sidebarAd3] = await Promise.all([
    getScEventsByVenue(venue).catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);

  if (events.length === 0) notFound();

  const { upcoming, past, name, address } = venueData(events);
  const pastItems = past.map(({ event, last }) => ({
    slug: event.slug,
    title: stripHtml(event.title.rendered),
    date: last.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  }));

  return (
    <main className="evx evl evv">
      <div className="evx-crumb">
        <Suspense
          fallback={
            <Link href="/events" className="evx-back">
              Back to events
            </Link>
          }
        >
          <BackToEvent />
        </Suspense>
        <span>
          <Link href="/events">Events</Link> › Venues › {name}
        </span>
      </div>

      <div className="evl-head evv-head">
        <div>
          <p className="evx-eyebrow">Venue</p>
          <h1>{name}</h1>
          {address && <p className="evl-intro">{address}</p>}
        </div>
      </div>

      <div className="evl-layout evv-layout">
        <div className="evl-main evv-main">
          <section className="evl-group">
            <h2>
              Coming up <span className="evx-count">{upcoming.length}</span>
            </h2>
            {upcoming.length > 0 ? (
              <div className="evx-grid evx-grid-2">
                {upcoming.map(({ event, next }) => (
                  <EventCard key={event.id} event={event} occurrence={next} tone="dark" />
                ))}
              </div>
            ) : (
              <div className="evl-empty">
                <h2>Nothing coming up here yet.</h2>
                <p>Know of something happening at {name}? Add it and it goes live straight away.</p>
                <Link className="evl-btn-submit" href="/events/submit">
                  Submit an event
                </Link>
              </div>
            )}
          </section>

          {pastItems.length > 0 && (
            <section className="evl-group evv-past">
              <h2>
                Past events <span className="evx-count">{pastItems.length}</span>
              </h2>
              <PastEventsList items={pastItems} />
            </section>
          )}
        </div>

        <aside className="evl-side evv-side">
          <VenueCard name={name} address={address} showOpenInMaps className="evv-venue" />
          <div className="evv-ads">
            <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} />
          </div>
        </aside>
      </div>
    </main>
  );
}
