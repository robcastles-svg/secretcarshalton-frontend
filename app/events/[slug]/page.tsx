import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/app/_components/CommentSection";
import { PostViewTracker } from "@/app/_components/PostViewTracker";
import { StyledMap } from "@/app/_components/StyledMap";
import { getSessionToken } from "@/lib/auth";
import {
  displayOccurrence,
  eventJsonLd,
  formatTime,
  formatTimeRange,
  getBooking,
  getOccurrences,
  getPrice,
  googleCalendarUrl,
  isFinished,
  isRepeating,
  relativeDayLabel,
  upcomingOccurrences,
  venueQuery,
  venueShort,
  dateParts,
  type Booking,
  type Occurrence,
  type PriceInfo,
} from "@/lib/event-view";
import {
  getCommentsForPost,
  getEventRsvpStatus,
  getFeaturedImage,
  getMemberMe,
  getMembersByIds,
  getRecentScEventSlugs,
  getScEventBySlug,
  getScEventTags,
  slugifyVenue,
  stripHtml,
  type WPScEvent,
} from "@/lib/wordpress";
import { CopyButton } from "../_components/CopyButton";
import { DateTile } from "../_components/DateTile";
import {
  CalendarIcon,
  ChevronIcon,
  ClockIcon,
  DirectionsIcon,
  ExternalIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  RepeatIcon,
  TagIcon,
  TicketIcon,
} from "../_components/EvIcons";
import { ClaimEventButton } from "./_components/ClaimEventButton";
import { EventDetailImage } from "./_components/EventDetailImage";
import { RsvpButton } from "./_components/RsvpButton";
import { ShareEventRow } from "./_components/ShareEventRow";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getRecentScEventSlugs(50).catch(() => []);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getScEventBySlug(slug).catch(() => null);
  if (!event) return {};

  const title = stripHtml(event.title.rendered);
  const description = stripHtml(event.content.rendered).slice(0, 160) || undefined;
  const image = getFeaturedImage(event);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image.source_url] : undefined,
    },
  };
}

/**
 * The sidebar booking card (and, on mobile, its sticky bottom bar),
 * driven by the Stage 1 price/booking fields — see getBooking for how
 * older events without them are handled.
 */
function BookingCard({
  event,
  booking,
  price,
  next,
  finished,
  organizerHref,
}: {
  event: WPScEvent;
  booking: Booking;
  price: PriceInfo | null;
  next: Occurrence | null;
  finished: boolean;
  organizerHref: string | null;
}) {
  if (finished) {
    return (
      <>
        <p className="evx-eyebrow">Booking</p>
        <p className="evx-booktext">This event has finished, so booking is closed.</p>
        {organizerHref && (
          <Link className="evx-btn-dark" href={organizerHref}>
            More from this organiser
          </Link>
        )}
      </>
    );
  }

  const priceBlock = price && (
    <div className="evx-price">
      <b>{price.headline}</b>
      {price.note && <span>{price.note}</span>}
    </div>
  );

  if (booking.kind === "contact") {
    return (
      <>
        <p className="evx-eyebrow">Booking</p>
        {priceBlock}
        {booking.email ? (
          <a className="evx-btn-primary" href={`mailto:${booking.email}`}>
            <MailIcon />
            Email to book
          </a>
        ) : (
          booking.phone && (
            <a className="evx-btn-primary" href={`tel:${booking.phone.replace(/\s+/g, "")}`}>
              <PhoneIcon />
              Call to book
            </a>
          )
        )}
        <ul className="evx-contact">
          {booking.email && (
            <li>
              <MailIcon />
              <span className="evx-contact-v">{booking.email}</span>
              <CopyButton value={booking.email} />
            </li>
          )}
          {booking.phone && (
            <li>
              <PhoneIcon />
              <span className="evx-contact-v">{booking.phone}</span>
              <CopyButton value={booking.phone} />
            </li>
          )}
        </ul>
      </>
    );
  }

  if (booking.kind === "link") {
    return (
      <>
        <p className="evx-eyebrow">Tickets &amp; info</p>
        {priceBlock ?? <p className="evx-booktext">Prices and tickets are on the organiser&apos;s website.</p>}
        <a className="evx-btn-primary" href={booking.url} target="_blank" rel="noopener noreferrer">
          {booking.linkKind === "tickets" ? "Get tickets" : "Visit website"}
          <ExternalIcon />
        </a>
        <p className="evx-via">Opens {booking.domain}</p>
      </>
    );
  }

  const calendar = next && (
    <a className="evx-btn-primary" href={googleCalendarUrl(event, next)} target="_blank" rel="noopener noreferrer">
      <CalendarIcon />
      Add to calendar
    </a>
  );

  if (booking.kind === "none") {
    return (
      <>
        <p className="evx-eyebrow">Booking</p>
        {priceBlock}
        <p className="evx-booktext">No booking needed, just turn up.</p>
        {calendar}
      </>
    );
  }

  // Older events with nothing recorded about booking.
  return (
    <>
      <p className="evx-eyebrow">Booking</p>
      {priceBlock}
      <p className="evx-booktext">
        {organizerHref ? (
          <>
            For tickets and details, <Link href={organizerHref}>contact the organiser</Link>.
          </>
        ) : (
          "Check with the organiser for tickets and details."
        )}
      </p>
      {calendar}
    </>
  );
}

/** Mobile-only bar pinned to the bottom of the screen with the price and the main action. */
function StickyBookBar({
  event,
  booking,
  price,
  next,
  whenLabel,
}: {
  event: WPScEvent;
  booking: Booking;
  price: PriceInfo | null;
  next: Occurrence | null;
  whenLabel: string;
}) {
  if (booking.kind === "link") {
    return (
      <div className="evx-sticky">
        <div className="evx-sticky-p">
          <b>{price ? price.chip : whenLabel}</b>
          <span>{price ? whenLabel : booking.domain}</span>
        </div>
        <a className="evx-btn-primary" href={booking.url} target="_blank" rel="noopener noreferrer">
          {booking.linkKind === "tickets" ? "Get tickets" : "Visit website"}
        </a>
      </div>
    );
  }
  if (booking.kind === "contact") {
    return (
      <div className="evx-sticky">
        <div className="evx-sticky-p">
          <b>{price ? price.chip : "Booking"}</b>
          <span>{whenLabel}</span>
        </div>
        <a className="evx-btn-primary" href="#booking">
          Book
        </a>
      </div>
    );
  }
  if (!next) return null;
  return (
    <div className="evx-sticky">
      <div className="evx-sticky-p">
        <b>{booking.kind === "none" ? `${price ? price.chip : "No booking"} · just turn up` : price?.chip ?? whenLabel}</b>
        <span>{whenLabel}</span>
      </div>
      <a className="evx-btn-primary" href={googleCalendarUrl(event, next)} target="_blank" rel="noopener noreferrer">
        Add to calendar
      </a>
    </div>
  );
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getScEventBySlug(slug).catch(() => null);

  if (!event) notFound();

  const [sessionToken, fullThread, allTags] = await Promise.all([
    getSessionToken(),
    getCommentsForPost(event.id, 50).catch(() => []),
    getScEventTags().catch(() => []),
  ]);

  const [profile, rsvpStatus] = await Promise.all([
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
    sessionToken ? getEventRsvpStatus(sessionToken, event.id) : Promise.resolve(null),
  ]);

  const commenterProfileMap = await getMembersByIds(fullThread.map((c) => c.author ?? 0)).catch(
    () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string; tier?: string }>()
  );

  const isOwner = Boolean(profile && profile.id === event.author);
  const canEdit = isOwner || Boolean(profile?.is_editor);

  const title = stripHtml(event.title.rendered);
  const image = getFeaturedImage(event);
  const now = Date.now();
  const finished = isFinished(event, now);
  const repeating = isRepeating(event);
  const shown = displayOccurrence(event, now);
  const upcoming = upcomingOccurrences(event, now);
  const next = finished ? null : upcoming[0] ?? null;
  const price = getPrice(event);
  const booking = getBooking(event);
  const time = shown ? formatTimeRange(shown) : null;
  const venue = venueShort(event);
  const mapQuery = venueQuery(event);
  const topic = allTags.find((t) => event.sc_event_tag?.includes(t.id)) ?? null;
  const org = event.sc_event_organizer_profile ?? null;
  const organizerHref = org ? `/events/organiser/${org.slug}?from=${encodeURIComponent(event.slug)}` : null;
  const venueHref = event.meta.sc_venue_name ? `/events/venue/${slugifyVenue(event.meta.sc_venue_name)}` : null;
  const shownParts = shown ? dateParts(shown.start) : null;
  // "Thu 22 Oct, 7:30 pm" (or "Next: …" for repeating events) — the sticky bar's second line.
  const whenLabel = shown && shownParts
    ? `${repeating && !finished ? "Next: " : ""}${shownParts.label.replace(/ \d{4}$/, "")}${time ? `, ${formatTime(shown.start)}` : ""}`
    : "";

  return (
    <main className="evx evx-page-event">
      {getOccurrences(event).length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(event, image?.source_url ?? null, now)) }}
        />
      )}
      <PostViewTracker postId={event.id} slug={event.slug} title={title} />

      <div className="evx-crumb">
        <Link href="/events" className="evx-back">
          <ChevronIcon />
          Back to events
        </Link>
        <span>
          <Link href="/events">Events</Link>
          {topic && (
            <>
              {" › "}
              <Link href={`/events?tag=${topic.slug}`}>{topic.name}</Link>
            </>
          )}
        </span>
      </div>

      <div className="evx-layout">
        <div className="evx-main">
          <article className="evx-seg evx-seg-head">
            {finished && (
              <div className="evx-ended">
                <b>This event has finished.</b>
                {org && organizerHref && (
                  <Link href={organizerHref}>See what {org.name} have coming up →</Link>
                )}
              </div>
            )}
            <div className="evx-headrow">
              {shown && <DateTile date={shown.start} withYear size="lg" />}
              <div className="evx-headtxt">
                {shown && <span className="evx-soon">{relativeDayLabel(shown, finished, repeating && !finished, now)}</span>}
                <h1 className="evx-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                {canEdit && (
                  <Link href={`/events/${event.slug}/edit`} className="evx-edit">
                    Edit event
                  </Link>
                )}
              </div>
            </div>
            <ul className="evx-facts">
              {time && (
                <li>
                  <ClockIcon />
                  {time}
                </li>
              )}
              {venue && (
                <li>
                  <PinIcon />
                  {venueHref ? <Link href={venueHref}>{venue}</Link> : venue}
                </li>
              )}
              {price && (
                <li className={price.kind === "free" ? "evx-fact-free" : undefined}>
                  <TicketIcon />
                  {price.chip}
                </li>
              )}
              {repeating && event.meta.sc_repeat_pattern && (
                <li className="evx-fact-rep">
                  <RepeatIcon />
                  {event.meta.sc_repeat_pattern}
                </li>
              )}
              {topic && (
                <li className="evx-fact-tag">
                  <TagIcon />
                  <Link href={`/events?tag=${topic.slug}`}>{topic.name}</Link>
                </li>
              )}
            </ul>
            {image && (
              <div className="evx-hero">
                <EventDetailImage image={image} alt={title} />
              </div>
            )}
            <div className="evx-actions">
              {next && booking.kind !== "none" && (
                <a className="evx-btn" href={googleCalendarUrl(event, next)} target="_blank" rel="noopener noreferrer">
                  <CalendarIcon />
                  {repeating ? "Add next date" : "Add to calendar"}
                </a>
              )}
              <RsvpButton
                eventId={event.id}
                isLoggedIn={Boolean(sessionToken)}
                initialGoing={rsvpStatus?.going ?? false}
                initialCount={rsvpStatus?.going_count ?? event.sc_event_rsvp_count ?? 0}
              />
              <ShareEventRow path={`/events/${event.slug}`} title={title} />
            </div>
          </article>

          <article className="evx-seg evx-seg-body">
            <div className="evx-desc" dangerouslySetInnerHTML={{ __html: event.content.rendered }} />

            {repeating && upcoming.length > 0 && (
              <div className="evx-more-dates">
                <h2>More dates</h2>
                <p className="evx-sub">
                  {event.meta.sc_repeat_pattern ? `${event.meta.sc_repeat_pattern}. ` : ""}Same time and place each
                  date.
                </p>
                <ul className="evx-date-list">
                  {upcoming.map((o, i) => (
                    <li key={o.start.getTime()} className={i === 0 ? "evx-date-next" : undefined}>
                      <span className="evx-date-d">
                        {dateParts(o.start).label}
                        {i === 0 && <span className="evx-date-lbl"> Next</span>}
                      </span>
                      <a
                        className="evx-btn evx-btn-sm"
                        href={googleCalendarUrl(event, o)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Add ${dateParts(o.start).label} to calendar`}
                      >
                        <CalendarIcon />
                        Add
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="evx-fix">
              Spotted something wrong, like a changed date or venue? <Link href="/contact">Suggest a correction</Link>
            </p>
            {/*
             * "Hosted by [business]" (sc_event_listing_id) is due to move
             * onto the organiser (brief, Stage 4) — kept here, low-key,
             * until then so events that use it don't lose the link.
             */}
            {event.sc_event_company ? (
              <p className="evx-fix">
                Hosted by <Link href={`/directory/${event.sc_event_company.slug}`}>{event.sc_event_company.name}</Link>
              </p>
            ) : (
              event.sc_event_author_is_staff && (
                <div className="evx-claim">
                  <ClaimEventButton
                    eventId={event.id}
                    isLoggedIn={Boolean(sessionToken)}
                    initialPending={Boolean(event.sc_event_claim_pending)}
                  />
                </div>
              )
            )}
          </article>

          <article className="evx-seg evx-seg-comments">
            <CommentSection
              postId={event.id}
              comments={fullThread}
              isLoggedIn={Boolean(sessionToken)}
              commenterProfiles={commenterProfileMap}
              currentUserId={profile?.id}
              showVotes={false}
            />
          </article>
        </div>

        <aside className="evx-side">
          <section className="evx-card-dk evx-book" id="booking">
            <BookingCard
              event={event}
              booking={booking}
              price={price}
              next={next}
              finished={finished}
              organizerHref={organizerHref}
            />
          </section>

          {org && organizerHref ? (
            <section className="evx-card-dk evx-org">
              <p className="evx-eyebrow">Organiser</p>
              <Link className="evx-org-btn" href={organizerHref}>
                <span>
                  <span className="evx-org-name">{org.name}</span>
                  <span className="evx-org-sub">Contact details and more events</span>
                </span>
                <ChevronIcon />
              </Link>
            </section>
          ) : (
            event.meta.sc_organizer && (
              <section className="evx-card-dk evx-org">
                <p className="evx-eyebrow">Organiser</p>
                <p className="evx-org-plain">{event.meta.sc_organizer}</p>
              </section>
            )
          )}

          {mapQuery && (
            <section className="evx-card-dk evx-venue">
              <p className="evx-eyebrow">Venue</p>
              {event.meta.sc_venue_name && <h3>{event.meta.sc_venue_name}</h3>}
              {event.meta.sc_venue_address && <p className="evx-addr">{event.meta.sc_venue_address}</p>}
              <div className="evx-map">
                <StyledMap query={mapQuery} />
              </div>
              <div className="evx-venue-actions">
                <a
                  className="evx-btn-dark"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DirectionsIcon />
                  Directions
                </a>
                {venueHref && (
                  <Link className="evx-text-link" href={venueHref}>
                    All events here →
                  </Link>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      {!finished && (
        <StickyBookBar event={event} booking={booking} price={price} next={next} whenLabel={whenLabel} />
      )}
    </main>
  );
}
