import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import {
  getCommentsByUser,
  getDirectoryListingsByAuthor,
  getFeaturedImage,
  getMemberMe,
  getScEventsByAuthor,
  getWPUserBySlug,
  parseEventDate,
  stripHtml,
} from "@/lib/wordpress";
import { ExpandableList } from "@/app/_components/ExpandableList";
import { EventImage } from "@/app/_components/EventImage";
import { BanMemberButton } from "./_components/BanMemberButton";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getWPUserBySlug(slug).catch(() => null);
  if (!user) return {};
  return { title: `${user.name} — Secret Carshalton` };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatEventDate(startDate: Date) {
  return startDate.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, sessionToken] = await Promise.all([
    getWPUserBySlug(slug).catch(() => null),
    getSessionToken(),
  ]);

  if (!user) notFound();

  const [allEvents, listings, comments, viewerProfile] = await Promise.all([
    getScEventsByAuthor(user.id).catch(() => []),
    getDirectoryListingsByAuthor(user.id).catch(() => []),
    getCommentsByUser(user.id),
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
  ]);
  const avatar = user.avatar_urls?.["96"] || user.avatar_urls?.["48"];

  const now = Date.now();
  const upcomingEvents = allEvents.filter((event) => {
    const start = parseEventDate(event.meta.sc_start);
    return start !== null && start.getTime() >= now;
  });
  const pastEvents = allEvents.filter((event) => {
    const start = parseEventDate(event.meta.sc_start);
    return start === null || start.getTime() < now;
  });
  // The one paid-upgrade event (see SC_Events_Meta::sc_event_featured)
  // currently sitting in the "Coming up next" hero slot on /events, if
  // this member owns it — surfaced separately from the plain upcoming
  // list below since it's the thing they're actively paying to promote.
  const promotedEvent = upcomingEvents.find((event) => event.meta.sc_event_featured);
  const promotedStart = promotedEvent ? parseEventDate(promotedEvent.meta.sc_start) : null;

  return (
    <main className="container">
      <div className="member-profile-breadcrumb">
        <span className="post-category">Member profile</span>
        <Link href="/members">&larr; All members</Link>
      </div>

      <div className="member-profile-header">
        {avatar && <img src={avatar} alt="" className="member-profile-avatar" />}
        <div>
          <h1>{user.name}</h1>
          {user.tier && <span className="member-tier-badge">{user.tier.label}</span>}
          {user.description && <p>{user.description}</p>}
        </div>
      </div>

      {viewerProfile?.is_editor && (
        <BanMemberButton userId={user.id} initialBanned={Boolean(user.banned)} />
      )}

      {/*
       * Not every point source has its own section below — RSVPing to an
       * event, for one, awards points but leaves nothing to list under
       * Events/Directory/Comments. Without this, a genuinely active
       * member's profile can end up with points but every section below
       * saying "nothing yet," which reads as broken rather than just a
       * different kind of engagement.
       */}
      {user.recent_activity && user.recent_activity.length > 0 && (
        <section className="dashboard-section">
          <h2>Recent activity</h2>
          <ul className="dashboard-activity-list">
            {user.recent_activity.map((entry, i) => (
              <li key={i}>
                <span className="dashboard-activity-points">+{entry.points}</span>
                <span>{entry.reason}</span>
                <time>{formatDate(entry.date)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {promotedEvent && promotedStart && (
        <section className="dashboard-section">
          <h2>Promoted event</h2>
          <Link href={`/events/${promotedEvent.slug}`} className="member-promoted-event">
            <EventImage image={getFeaturedImage(promotedEvent)} alt={stripHtml(promotedEvent.title.rendered)} />
            <div className="member-promoted-event-body">
              <span className="directory-badge">Featured</span>
              <span className="card-title" dangerouslySetInnerHTML={{ __html: promotedEvent.title.rendered }} />
              <time dateTime={promotedStart.toISOString()}>{formatEventDate(promotedStart)}</time>
            </div>
          </Link>
        </section>
      )}

      <section className="dashboard-section">
        <h2>Upcoming events submitted by {user.name}</h2>
        {upcomingEvents.length === 0 ? (
          <p className="dashboard-hint">Nothing upcoming right now.</p>
        ) : (
          <ExpandableList
            items={upcomingEvents}
            listClassName="post-list"
            itemKey={(event) => event.id}
            noun="event"
            renderItem={(event) => {
              const image = getFeaturedImage(event);
              const startDate = parseEventDate(event.meta.sc_start);
              return (
                <>
                  <Link href={`/events/${event.slug}`}>
                    {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                    <span className="card-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                  </Link>
                  {startDate && <time dateTime={startDate.toISOString()}>{formatEventDate(startDate)}</time>}
                </>
              );
            }}
          />
        )}
      </section>

      {/*
       * A plain list, not the image-card treatment above — these have
       * already happened, so this is a record of past engagement (what
       * Rob's looking at when judging a member's activity) rather than
       * something to promote.
       */}
      <section className="dashboard-section">
        <h2>Past events</h2>
        {pastEvents.length === 0 ? (
          <p className="dashboard-hint">No past events.</p>
        ) : (
          <ExpandableList
            items={pastEvents}
            listClassName="member-profile-link-list"
            itemKey={(event) => event.id}
            noun="event"
            renderItem={(event) => {
              const startDate = parseEventDate(event.meta.sc_start);
              return (
                <>
                  <Link href={`/events/${event.slug}`} dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                  {startDate && <time dateTime={startDate.toISOString()}>{formatEventDate(startDate)}</time>}
                </>
              );
            }}
          />
        )}
      </section>

      {/*
       * Deliberately a plain link list, not the full directory-listing
       * card treatment (image, address, verified tick) — Rob wants public
       * profiles kept basic so people still have a reason to visit the
       * real directory listing rather than getting everything here.
       */}
      <section className="dashboard-section">
        <h2>Directory listings</h2>
        {listings.length === 0 ? (
          <p className="dashboard-hint">No directory listings yet.</p>
        ) : (
          <ExpandableList
            items={listings}
            listClassName="member-profile-link-list"
            itemKey={(listing) => listing.id}
            noun="listing"
            renderItem={(listing) => (
              <Link href={`/directory/${listing.slug}`} dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
            )}
          />
        )}
      </section>

      <section className="dashboard-section">
        <h2>Comments</h2>
        {comments.length === 0 ? (
          <p className="dashboard-hint">No comments yet.</p>
        ) : (
          <ExpandableList
            items={comments}
            listClassName="member-profile-comment-list"
            itemKey={(comment) => comment.id}
            noun="comment"
            renderItem={(comment) => (
              <>
                {comment.link ? (
                  <Link href={comment.link}>{comment.post_title ?? "View"}</Link>
                ) : (
                  <span>{comment.post_title ?? "A post"}</span>
                )}
                <time>{formatDate(comment.date)}</time>
                <p>{stripHtml(comment.content.rendered)}</p>
              </>
            )}
          />
        )}
      </section>
    </main>
  );
}
