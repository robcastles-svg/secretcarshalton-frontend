import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedImage, getScEventsByOrganizer, parseEventDate } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const events = await getScEventsByOrganizer(slug).catch(() => []);
  const organizerName = events[0]?.sc_event_organizer_profile?.name;
  if (!organizerName) return {};
  return { title: `Events by ${organizerName} — Secret Carshalton` };
}

export default async function EventsByOrganizerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const events = await getScEventsByOrganizer(slug).catch(() => []);

  if (events.length === 0) notFound();

  const organizer = events[0].sc_event_organizer_profile;

  return (
    <main className="container">
      <span className="theme-eyebrow">Events by this organiser</span>
      <h1>{organizer?.name}</h1>
      {organizer?.address && <p className="dashboard-hint">{organizer.address}</p>}
      {organizer?.url && (
        <p>
          <a href={organizer.url} target="_blank" rel="noopener noreferrer">
            {organizer.url.replace(/^https?:\/\//, "")}
          </a>
        </p>
      )}
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
                  {startDate.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </time>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
