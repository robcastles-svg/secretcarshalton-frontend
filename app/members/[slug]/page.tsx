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

  const [events, listings, comments, viewerProfile] = await Promise.all([
    getScEventsByAuthor(user.id).catch(() => []),
    getDirectoryListingsByAuthor(user.id).catch(() => []),
    getCommentsByUser(user.id),
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
  ]);
  const avatar = user.avatar_urls?.["96"] || user.avatar_urls?.["48"];

  return (
    <main className="container">
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

      <section className="dashboard-section">
        <h2>Events submitted by {user.name}</h2>
        {events.length === 0 ? (
          <p className="dashboard-hint">No events submitted yet.</p>
        ) : (
          <ExpandableList
            items={events}
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
                  {startDate && (
                    <time dateTime={startDate.toISOString()}>
                      {startDate.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </time>
                  )}
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
