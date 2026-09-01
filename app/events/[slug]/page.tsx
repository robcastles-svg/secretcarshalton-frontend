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
import { RsvpButton } from "./_components/RsvpButton";

export const revalidate = 3600;

function formatTime(date: Date): string {
  return date.toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
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
    organizer: event.meta.sc_organizer
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
              <p className="event-meta-row">
                <span className="event-meta-label">Event Type</span>
                {eventTypes.map((t) => t.name).join(", ")}
              </p>
            )}
            {event.meta.sc_organizer && (
              <p className="event-meta-row">
                <span className="event-meta-label">Organised By</span>
                {event.meta.sc_organizer}
              </p>
            )}
          </div>
        </div>
        {image && <img src={image.source_url} alt={image.alt_text} />}

        <div className="event-detail-actions">
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
              <ClaimEventButton eventId={event.id} isLoggedIn={Boolean(sessionToken)} />
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

        <CommentSection
          postId={event.id}
          comments={fullThread}
          isLoggedIn={Boolean(sessionToken)}
          commenterProfiles={commenterProfileMap}
          currentUserId={profile?.id}
        />
      </div>

      <aside className="post-sidebar">
        {(event.meta.sc_event_url || addressParts.length > 0) && (
          <div className="sidebar-block">
            <h2>More info</h2>
            {addressParts.length > 0 && <p>{addressParts.join(", ")}</p>}
            {event.meta.sc_event_url && (
              <p>
                <a href={event.meta.sc_event_url} target="_blank" rel="noopener noreferrer">
                  {event.meta.sc_event_url.replace(/^https?:\/\//, "")}
                </a>
              </p>
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
