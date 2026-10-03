import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileTopAd } from "@/app/_components/MobileTopAd";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { getAd, getFeaturedImage, getScEventsByOrganizer, parseEventDate } from "@/lib/wordpress";

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
  const [events, sidebarAd1, sidebarAd2, sidebarAd3] = await Promise.all([
    getScEventsByOrganizer(slug).catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);

  if (events.length === 0) notFound();

  const organizer = events[0].sc_event_organizer_profile;

  return (
    <main className="container">
      <span className="theme-eyebrow">Events by this organiser</span>
      <h1>{organizer?.name}</h1>
      {organizer?.address && <p className="dashboard-hint">{organizer.address}</p>}
      {organizer?.phone && <p className="dashboard-hint">{organizer.phone}</p>}
      {organizer?.url && (
        <a href={organizer.url} target="_blank" rel="noopener noreferrer" className="button-pill button-pill-secondary">
          More info
        </a>
      )}
      <MobileTopAd ad={sidebarAd1} />
      <div className="post-layout">
        <div className="post-body">
          <ul className="post-list post-list-two-column">
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
        </div>
        <aside className="post-sidebar">
          <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} hideFirstOnMobile />
        </aside>
      </div>
    </main>
  );
}
