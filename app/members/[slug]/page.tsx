import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedImage, getScEventsByAuthor, getWPUserBySlug, parseEventDate } from "@/lib/wordpress";

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

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getWPUserBySlug(slug).catch(() => null);

  if (!user) notFound();

  const events = await getScEventsByAuthor(user.id).catch(() => []);
  const avatar = user.avatar_urls?.["96"] || user.avatar_urls?.["48"];

  return (
    <main className="container">
      <div className="member-profile-header">
        {avatar && <img src={avatar} alt="" className="member-profile-avatar" />}
        <div>
          <h1>{user.name}</h1>
          {user.description && <p>{user.description}</p>}
        </div>
      </div>

      <section className="dashboard-section">
        <h2>Events submitted by {user.name}</h2>
        {events.length === 0 ? (
          <p className="dashboard-hint">No events submitted yet.</p>
        ) : (
          <ul className="post-list">
            {events.map((event) => {
              const image = getFeaturedImage(event);
              const startDate = parseEventDate(event.meta.sc_start);
              return (
                <li key={event.id}>
                  <Link href={`/events/${event.slug}`}>
                    {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                    <span className="card-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                  </Link>
                  {startDate && (
                    <time dateTime={startDate.toISOString()}>
                      {startDate.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </time>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
