import Link from "next/link";
import { getFeaturedImage, getUpcomingScEvents, parseEventDate } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function EventsPage() {
  const events = await getUpcomingScEvents(100).catch(() => []);

  return (
    <main className="container">
      <div className="page-header-row">
        <h1>What&apos;s On</h1>
        <Link href="/events/submit" className="button-pill">
          Submit an event
        </Link>
      </div>
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
                  {startDate.toLocaleString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {event.meta.sc_venue_name ? ` — ${event.meta.sc_venue_name}` : ""}
                </time>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
