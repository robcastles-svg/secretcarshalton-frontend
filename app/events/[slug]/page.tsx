import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/app/_components/CommentSection";
import { getSessionToken } from "@/lib/auth";
import {
  getCommentsForPost,
  getEventRsvpStatus,
  getFeaturedImage,
  getMemberMe,
  getRecentScEventSlugs,
  getScEventBySlug,
  parseEventDate,
  slugifyVenue,
  stripHtml,
} from "@/lib/wordpress";
import { RsvpButton } from "./_components/RsvpButton";

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

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getScEventBySlug(slug).catch(() => null);

  if (!event) notFound();

  const [sessionToken, fullThread] = await Promise.all([
    getSessionToken(),
    getCommentsForPost(event.id, 50).catch(() => []),
  ]);

  const [profile, rsvpStatus] = await Promise.all([
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
    sessionToken ? getEventRsvpStatus(sessionToken, event.id) : Promise.resolve(null),
  ]);

  const isOwner = Boolean(profile && profile.id === event.author);

  const image = getFeaturedImage(event);
  const startDate = parseEventDate(event.meta.sc_start);

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
      <div className="post-body">
        <div className="page-header-row">
          <h1 dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
          {isOwner && (
            <Link href={`/events/${event.slug}/edit`} className="button-pill button-pill-secondary">
              Edit event
            </Link>
          )}
        </div>
        {startDate && (
          <p>
            <strong>
              {startDate.toLocaleString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "numeric",
                minute: "2-digit",
              })}
            </strong>
            {event.meta.sc_venue_name && (
              <>
                {" — "}
                {event.meta.sc_venue_name}
                {event.meta.sc_venue_address ? `, ${event.meta.sc_venue_address}` : ""}
              </>
            )}
          </p>
        )}
        {image && <img src={image.source_url} alt={image.alt_text} />}

        <RsvpButton
          eventId={event.id}
          isLoggedIn={Boolean(sessionToken)}
          initialGoing={rsvpStatus?.going ?? false}
          initialCount={rsvpStatus?.going_count ?? event.sc_event_rsvp_count ?? 0}
        />

        <div className="event-detail-actions">
          {event.meta.sc_venue_name && (
            <Link href={`/events/venue/${slugifyVenue(event.meta.sc_venue_name)}`} className="button-pill button-pill-secondary">
              See all events at {event.meta.sc_venue_name}
            </Link>
          )}
          {event._embedded?.author?.[0] && (
            <Link href={`/members/${event._embedded.author[0].slug}`} className="button-pill button-pill-secondary">
              Submitted by {event._embedded.author[0].name}
            </Link>
          )}
        </div>

        <div dangerouslySetInnerHTML={{ __html: event.content.rendered }} />

        <CommentSection postId={event.id} comments={fullThread} isLoggedIn={Boolean(sessionToken)} />
      </div>

      <aside className="post-sidebar">
        {(event.meta.sc_organizer || event.meta.sc_event_url || addressParts.length > 0) && (
          <div className="sidebar-block">
            <h2>More info</h2>
            {addressParts.length > 0 && <p>{addressParts.join(", ")}</p>}
            {event.meta.sc_organizer && (
              <p>
                Organised by <strong>{event.meta.sc_organizer}</strong>
              </p>
            )}
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
