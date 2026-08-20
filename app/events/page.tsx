import Link from "next/link";
import {
  getEvents,
  getEventSchema,
  getFeaturedImage,
  mapWithConcurrency,
  parseEventDate,
} from "@/lib/wordpress";

export const revalidate = 3600;

export default async function EventsPage() {
  const events = await getEvents(30);
  const schemas = await mapWithConcurrency(events, 5, (event) =>
    getEventSchema(event.slug).catch(() => null)
  );

  return (
    <main className="container">
      <h1>What&apos;s On</h1>
      <ul className="post-list">
        {events.map((event, index) => {
          const image = getFeaturedImage(event);
          const schema = schemas[index];
          const venue = schema?.location?.[0];
          const startDate = parseEventDate(schema?.startDate);
          return (
            <li key={event.id}>
              <Link href={`/events/${event.slug}`}>
                {image && <img src={image.source_url} alt={image.alt_text} />}
                <span dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
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
                  {venue?.name ? ` — ${venue.name}` : ""}
                </time>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
