import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedImage, getScEventsByVenue, parseEventDate } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ venue: string }>;
}): Promise<Metadata> {
  const { venue } = await params;
  const events = await getScEventsByVenue(venue).catch(() => []);
  const venueName = events[0]?.meta.sc_venue_name;
  if (!venueName) return {};
  return { title: `Events at ${venueName} — Secret Carshalton` };
}

export default async function EventsByVenuePage({
  params,
}: {
  params: Promise<{ venue: string }>;
}) {
  const { venue } = await params;
  const events = await getScEventsByVenue(venue).catch(() => []);

  if (events.length === 0) notFound();

  const venueName = events[0].meta.sc_venue_name;
  const venueAddress = events[0].meta.sc_venue_address;

  return (
    <main className="container">
      <span className="theme-eyebrow">Events at this venue</span>
      <h1>{venueName}</h1>
      {venueAddress && <p className="dashboard-hint">{venueAddress}</p>}
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
    </main>
  );
}
