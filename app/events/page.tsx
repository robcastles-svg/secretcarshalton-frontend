import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { EventImage } from "@/app/_components/EventImage";
import { SidebarAds } from "@/app/_components/SidebarAds";
import {
  getAd,
  getFeaturedImage,
  getLatestAddedScEvents,
  getScEventCategories,
  getScEventTags,
  getScEvents,
  getUpcomingScEvents,
  parseEventDate,
  stripHtml,
} from "@/lib/wordpress";
import { EventCalendarMonth } from "./_components/EventCalendarMonth";
import { EventCategoryTiles } from "./_components/EventCategoryTiles";
import { EventCountdown } from "./_components/EventCountdown";
import { EventTagTiles } from "./_components/EventTagTiles";
import { EventsGrid } from "./_components/EventsGrid";

export const revalidate = 3600;

/** Builds the `?category=&tag=` query string shared by the list/calendar view-switch links. */
function filterQuery(categorySlug?: string, tagSlug?: string, hasLeadingParam = false): string {
  const params: string[] = [];
  if (categorySlug) params.push(`category=${categorySlug}`);
  if (tagSlug) params.push(`tag=${tagSlug}`);
  if (params.length === 0) return "";
  return (hasLeadingParam ? "&" : "?") + params.join("&");
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string; tag?: string; year?: string; month?: string }>;
}) {
  const { view, category, tag, year, month } = await searchParams;
  const isCalendar = view === "calendar";
  const now = new Date();
  const calendarYear = Number(year) || now.getFullYear();
  const calendarMonth = Number(month) || now.getMonth() + 1;

  const [categories, tags, upcoming, allEvents, latestAdded, inFeedAd, sidebarAd] = await Promise.all([
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getUpcomingScEvents(100).catch(() => []),
    getScEvents(300).catch(() => []),
    getLatestAddedScEvents(5).catch(() => []),
    getAd("in_feed"),
    getAd("sidebar"),
  ]);

  const activeCategory = category ? categories.find((c) => c.slug === category) : null;
  const activeTag = tag ? tags.find((t) => t.slug === tag) : null;
  const matchesFilters = (e: { sc_event_category?: number[]; sc_event_tag?: number[] }) =>
    (!activeCategory || e.sc_event_category?.includes(activeCategory.id)) &&
    (!activeTag || e.sc_event_tag?.includes(activeTag.id));
  const calendarEvents = allEvents.filter(matchesFilters);
  // The list view is month-browsed rather than paginated by count (Events
  // is the one card grid that isn't) — same year/month params the calendar
  // already uses, just applied to a flat sorted list instead of a grid.
  const listEvents = calendarEvents
    .filter((e) => {
      const start = parseEventDate(e.meta.sc_start);
      return start && start.getFullYear() === calendarYear && start.getMonth() + 1 === calendarMonth;
    })
    .sort((a, b) => {
      const aStart = parseEventDate(a.meta.sc_start);
      const bStart = parseEventDate(b.meta.sc_start);
      return (aStart?.getTime() ?? 0) - (bStart?.getTime() ?? 0);
    });

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const prevMonth = calendarMonth === 1 ? { year: calendarYear - 1, month: 12 } : { year: calendarYear, month: calendarMonth - 1 };
  const nextMonth = calendarMonth === 12 ? { year: calendarYear + 1, month: 1 } : { year: calendarYear, month: calendarMonth + 1 };

  // A paid-upgrade "featured" event (see SC_Events_Meta::sc_event_featured)
  // takes the "Coming up next" hero slot over whatever's chronologically
  // soonest — that's the whole point of the upgrade. Falls back to the
  // soonest upcoming event when nothing's currently featured.
  const next = upcoming.find((e) => e.meta.sc_event_featured) ?? upcoming[0];
  const nextStart = next ? parseEventDate(next.meta.sc_start) : null;
  const nextImage = next ? getFeaturedImage(next) : null;

  return (
    // A deliberate visual break from the rest of the (light) site — Events
    // gets a dark "night out" feel of its own. Scoped to this page only
    // (the shared header/nav above it stays light); individual cards keep
    // their own white backgrounds (.post-list, .event-row-list) so only
    // the ambient page chrome — headings, tiles, the list/calendar switch —
    // needed dark-mode colour overrides, not a full component rebuild.
    <div className="events-dark">
      <nav className="container secondary-nav">
        <EventCategoryTiles
          categories={categories}
          activeSlug={activeCategory?.slug}
          activeTagSlug={activeTag?.slug}
        />
        <EventTagTiles tags={tags} activeSlug={activeTag?.slug} activeCategorySlug={activeCategory?.slug} />
      </nav>

      <main className="container">
        <div className="page-header-row">
          <h1>
            What&apos;s On
            <CategoryKeyIcon />
          </h1>
          <Link href="/events/submit" className="button-pill">
            Submit an event
          </Link>
        </div>

        <div className="event-view-switch">
          <Link
            href={`/events${filterQuery(activeCategory?.slug, activeTag?.slug)}`}
            className={!isCalendar ? "active" : undefined}
          >
            List
          </Link>
          <Link
            href={`/events?view=calendar${filterQuery(activeCategory?.slug, activeTag?.slug, true)}`}
            className={isCalendar ? "active" : undefined}
          >
            Calendar
          </Link>
        </div>

        {next && nextStart && (
          <EventCountdown
            title={next.title.rendered}
            slug={next.slug}
            startIso={nextStart.toISOString()}
            venueName={next.meta.sc_venue_name}
            image={nextImage}
            imageAlt={stripHtml(next.title.rendered)}
            featured={Boolean(next.meta.sc_event_featured)}
          />
        )}

        <div className="post-layout">
          <div className="post-body">
            {isCalendar ? (
              <EventCalendarMonth year={calendarYear} month={calendarMonth} events={calendarEvents} />
            ) : (
              <>
                <div className="event-calendar-header event-list-month-header">
                  <Link
                    href={`/events?year=${prevMonth.year}&month=${prevMonth.month}${filterQuery(activeCategory?.slug, activeTag?.slug, true)}`}
                    aria-label="Previous month"
                  >
                    ←
                  </Link>
                  <h2>
                    {MONTH_NAMES[calendarMonth - 1]} {calendarYear}
                  </h2>
                  <Link
                    href={`/events?year=${nextMonth.year}&month=${nextMonth.month}${filterQuery(activeCategory?.slug, activeTag?.slug, true)}`}
                    aria-label="Next month"
                  >
                    →
                  </Link>
                </div>
                {listEvents.length === 0 ? (
                  <p className="directory-empty">No events in {MONTH_NAMES[calendarMonth - 1]} {calendarYear} — try another month.</p>
                ) : (
                  <EventsGrid events={listEvents} />
                )}
              </>
            )}
          </div>
          <aside className="post-sidebar">
            <SidebarAds ads={[inFeedAd, sidebarAd]} />
          </aside>
        </div>

        {latestAdded.length > 0 && (
          <section className="home-section event-latest-added">
            <h2>Latest events added</h2>
            <ul className="event-row-list">
              {latestAdded.map((event) => {
                const image = getFeaturedImage(event);
                const startDate = parseEventDate(event.meta.sc_start);
                return (
                  <li key={event.id}>
                    <Link href={`/events/${event.slug}`}>
                      <EventImage image={image} alt={stripHtml(event.title.rendered)} />
                      <div className="event-card-heading">
                        {startDate && (
                          <div className="event-card-date-badge">
                            <span className="event-card-date-badge-weekday">
                              {startDate.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
                            </span>
                            <span className="event-card-date-badge-day">{startDate.getDate()}</span>
                            <span className="event-card-date-badge-month">
                              {startDate.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="card-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
