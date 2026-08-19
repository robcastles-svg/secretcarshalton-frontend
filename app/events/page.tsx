import Link from "next/link";
import { getEvents } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function EventsPage() {
  const events = await getEvents(100);

  return (
    <main className="container">
      <h1>What&apos;s On</h1>
      <ul className="post-list">
        {events.map((event) => (
          <li key={event.id}>
            <Link href={`/events/${event.slug}`}>
              <span dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
