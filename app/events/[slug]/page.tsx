import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentCountLink } from "@/app/_components/CommentCountLink";
import { CommentSection } from "@/app/_components/CommentSection";
import { PostViewTracker } from "@/app/_components/PostViewTracker";
import { getSessionToken } from "@/lib/auth";
import {
  getCommentsForPost,
  getEventRsvpStatus,
  getFeaturedImage,
  getMemberMe,
  getMembersByIds,
  getRecentScEventSlugs,
  getScEventBySlug,
  getScEventTags,
  parseEventDate,
  slugifyVenue,
  stripHtml,
} from "@/lib/wordpress";
import { ClaimEventButton } from "./_components/ClaimEventButton";
import { EventTimeLeft } from "./_components/EventTimeLeft";
import { RsvpButton } from "./_components/RsvpButton";
import { ShareEventRow } from "./_components/ShareEventRow";

export const revalidate = 3600;

function formatTime(date: Date): string {
  return date.toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** YYYYMMDDTHHMMSSZ, the format Google Calendar's own template URL wants, always in UTC regardless of the site's displayed local time. */
function toGCalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** No end time on record for plenty of events — defaults to a 1 hour slot rather than leaving the calendar entry zero-length. */
function buildGoogleCalendarUrl(title: string, start: Date, end: Date | null, location: string, details: string): string {
  const endDate = end ?? new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGCalDateTime(start)}/${toGCalDateTime(endDate)}`,
    details,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * One distinct glyph per subject tag (see SC_Events_CPT::default_tags for
 * the full 13) — matching EventON's own "Event Type" list, which shows an
 * icon per tag rather than the plain comma-joined text this page used to
 * render. EVENT_TYPE_ICON_PATHS falls back to a generic tag glyph for any
 * tag name it doesn't recognise, so a future addition to default_tags()
 * degrades gracefully instead of rendering nothing.
 */
function EventTypeIcon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;
  switch (name) {
    case "Comedy":
      return (
        <svg {...common}>
          <path d="M4 5h16v10H9l-4 4v-4H4V5Z" strokeLinejoin="round" />
        </svg>
      );
    case "Dance":
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v5M12 12l-4 5M12 12l4 5M9 9l3 1 3-1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Festival":
      return (
        <svg {...common}>
          <polygon points="12 2 14.9 8.3 22 9 17 14.1 18.2 22 12 18.6 5.8 22 7 14.1 2 9 9.1 8.3" strokeLinejoin="round" />
        </svg>
      );
    case "Fitness":
      return (
        <svg {...common}>
          <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" strokeLinecap="round" />
        </svg>
      );
    case "Free Entry":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="11" x2="12" y2="16" strokeLinecap="round" />
          <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "Heritage":
      return (
        <svg {...common}>
          <path d="M12 2 3 8h18L12 2Z" strokeLinejoin="round" />
          <path d="M5 8v12M9 8v12M15 8v12M19 8v12M3 20h18" strokeLinecap="round" />
        </svg>
      );
    case "Music":
      return (
        <svg {...common}>
          <path d="M9 18V5l10-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </svg>
      );
    case "Nature":
      return (
        <svg {...common}>
          <path d="M5 20c0-8 5-14 14-16-1 9-6 15-14 16Z" strokeLinejoin="round" />
        </svg>
      );
    case "Quiz":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" strokeLinecap="round" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "Shopping":
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
        </svg>
      );
    case "Suitable for kids":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="0.8" fill="currentColor" stroke="none" />
          <path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" strokeLinecap="round" />
        </svg>
      );
    case "Theatre":
      return (
        <svg {...common}>
          <path d="M4 4c4 2 4 14 0 16M20 4c-4 2-4 14 0 16" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 4v16M5 7l14 10M19 7 5 17" strokeLinecap="round" />
        </svg>
      );
  }
}

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
    () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string }>()
  );

  const isOwner = Boolean(profile && profile.id === event.author);
  const canEdit = isOwner || Boolean(profile?.is_editor);

  const image = getFeaturedImage(event);
  const startDate = parseEventDate(event.meta.sc_start);
  const endDate = parseEventDate(event.meta.sc_end);
  const eventTypes = allTags.filter((t) => event.sc_event_tag?.includes(t.id));

  const addressParts = [event.meta.sc_venue_name, event.meta.sc_venue_address].filter(Boolean);
  const mapQuery = addressParts.join(", ");

  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: stripHtml(event.title.rendered),
    startDate: event.meta.sc_start || undefined,
    endDate: event.meta.sc_end || undefined,
    location: event.meta.sc_venue_name
      ? {
          "@type": "Place",
          name: event.meta.sc_venue_name,
          address: event.meta.sc_venue_address || undefined,
        }
      : undefined,
    organizer: event.sc_event_organizer_profile
      ? {
          "@type": "Organization",
          name: event.sc_event_organizer_profile.name,
          url: event.sc_event_organizer_profile.url || undefined,
        }
      : event.meta.sc_organizer
      ? { "@type": "Organization", name: event.meta.sc_organizer, url: event.meta.sc_event_url || undefined }
      : undefined,
    image: image ? [image.source_url] : undefined,
  };

  return (
    <article className="container post-layout">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <PostViewTracker postId={event.id} slug={event.slug} title={stripHtml(event.title.rendered)} />
      <div className="post-body">
        <div className="event-hero">
          {startDate && (
            <div className="event-date-tile">
              <span className="event-date-year">{startDate.getFullYear()}</span>
              <span className="event-date-weekday">
                {startDate.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
              </span>
              <span className="event-date-day">{startDate.getDate()}</span>
              <span className="event-date-month">
                {startDate.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
              </span>
            </div>
          )}
          <div className="event-hero-body">
            <div className="page-header-row">
              <h1 dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
              {canEdit && (
                <Link href={`/events/${event.slug}/edit`} className="button-pill button-pill-active">
                  Edit event
                </Link>
              )}
            </div>
            {event.meta.sc_venue_name && (
              <p className="event-meta-row">
                <PinIcon />
                {event.meta.sc_venue_name}
                {event.meta.sc_venue_address ? `, ${event.meta.sc_venue_address}` : ""}
              </p>
            )}
            {startDate && (
              <p className="event-meta-row">
                <ClockIcon />
                {formatTime(startDate)}
                {endDate ? ` – ${formatTime(endDate)}` : ""}
              </p>
            )}
            {fullThread.length > 0 && (
              <div className="event-meta-row">
                <CommentCountLink count={fullThread.length} />
              </div>
            )}
            {eventTypes.length > 0 && (
              <div className="event-meta-row event-type-row">
                <span className="event-meta-label">Event Type</span>
                <ul className="event-type-list">
                  {eventTypes.map((t) => (
                    <li key={t.id}>
                      <EventTypeIcon name={t.name} />
                      {t.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.sc_event_organizer_profile ? (
              <p className="event-meta-row">
                <span className="event-meta-label">Organised By</span>
                <Link href={`/events/organiser/${event.sc_event_organizer_profile.slug}`}>
                  {event.sc_event_organizer_profile.name}
                </Link>
              </p>
            ) : (
              event.meta.sc_organizer && (
                <p className="event-meta-row">
                  {/*
                   * No link here, even though sc_event_url is often set —
                   * "Organised By" reads as site navigation, and sending
                   * people straight off Secret Carshalton from it is the
                   * exact thing Rob flagged. Once SC_Events_CPT::backfill_organizer_terms
                   * runs (see its docblock), every event with a legacy name
                   * gets a real sc_event_organizer_profile and lands in the
                   * branch above instead — this is only the gap before
                   * that backfill has run on a given environment.
                   */}
                  <span className="event-meta-label">Organised By</span>
                  {event.meta.sc_organizer}
                </p>
              )
            )}
            {startDate && startDate.getTime() > Date.now() && <EventTimeLeft startIso={event.meta.sc_start} />}
          </div>
        </div>
        {image && <img src={image.source_url} alt={image.alt_text} />}

        <div className="event-detail-actions">
          {startDate && (
            <a
              href={buildGoogleCalendarUrl(
                stripHtml(event.title.rendered),
                startDate,
                endDate,
                mapQuery,
                stripHtml(event.content.rendered).slice(0, 500)
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="button-pill button-pill-secondary"
            >
              Add to Google Calendar
            </a>
          )}
          {event.meta.sc_venue_name && (
            <Link href={`/events/venue/${slugifyVenue(event.meta.sc_venue_name)}`} className="button-pill button-pill-secondary">
              See all events at {event.meta.sc_venue_name}
            </Link>
          )}
          {/*
           * No "Submitted by [member]" fallback — the public-facing
           * credit for an event is either a real business (sc_event_company,
           * linked to their directory listing) or the free-text Organiser
           * name already shown in the hero above, never a private member's
           * personal profile. Who actually submitted it is still visible to
           * the member themselves (My events on the dashboard) and to admins.
           */}
          {event.sc_event_company ? (
            <Link href={`/directory/${event.sc_event_company.slug}`} className="button-pill button-pill-secondary">
              Hosted by {event.sc_event_company.name}
            </Link>
          ) : (
            event.sc_event_author_is_staff && (
              <ClaimEventButton
                eventId={event.id}
                isLoggedIn={Boolean(sessionToken)}
                initialPending={Boolean(event.sc_event_claim_pending)}
              />
            )
          )}
        </div>

        <div dangerouslySetInnerHTML={{ __html: event.content.rendered }} />

        <p className="event-correction-link">
          Spotted something wrong — date changed, venue moved? <Link href="/contact">Suggest a correction</Link>.
        </p>

        <RsvpButton
          eventId={event.id}
          isLoggedIn={Boolean(sessionToken)}
          initialGoing={rsvpStatus?.going ?? false}
          initialCount={rsvpStatus?.going_count ?? event.sc_event_rsvp_count ?? 0}
        />

        <ShareEventRow path={`/events/${event.slug}`} title={stripHtml(event.title.rendered)} />

        <CommentSection
          postId={event.id}
          comments={fullThread}
          isLoggedIn={Boolean(sessionToken)}
          commenterProfiles={commenterProfileMap}
          currentUserId={profile?.id}
        />
      </div>

      <aside className="post-sidebar">
        {event.sc_event_organizer_profile && (
          <div className="sidebar-block">
            <h2>Organiser</h2>
            <p>
              <Link href={`/events/organiser/${event.sc_event_organizer_profile.slug}`}>
                {event.sc_event_organizer_profile.name}
              </Link>
            </p>
            {event.sc_event_organizer_profile.address && <p>{event.sc_event_organizer_profile.address}</p>}
            {event.sc_event_organizer_profile.phone && <p>{event.sc_event_organizer_profile.phone}</p>}
            {event.sc_event_organizer_profile.socials && <p>{event.sc_event_organizer_profile.socials}</p>}
            {/*
             * Goes to the organiser's own page, not profile.url directly —
             * that field is free text an organiser typed in when they were
             * created (see SC_Events_CPT::backfill_organizer_terms for the
             * legacy events it was migrated from), so it isn't guaranteed
             * to be a working link. The organiser page shows their real
             * website too when it has one, plus every other event by them.
             */}
            <p>
              <Link
                href={`/events/organiser/${event.sc_event_organizer_profile.slug}`}
                className="button-pill button-pill-secondary"
              >
                More info
              </Link>
            </p>
          </div>
        )}

        {(event.meta.sc_event_url || addressParts.length > 0) && (
          <div className="sidebar-block">
            <h2>More info</h2>
            {addressParts.length > 0 && <p>{addressParts.join(", ")}</p>}
            {event.meta.sc_event_url && (
              <a href={event.meta.sc_event_url} target="_blank" rel="noopener noreferrer" className="button-pill">
                Tickets / more info
              </a>
            )}
          </div>
        )}

        {mapQuery && (
          <div className="sidebar-block event-map">
            <iframe
              title="Event location map"
              width="100%"
              height="220"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            />
          </div>
        )}
      </aside>
    </article>
  );
}
