import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { SidebarAds } from "@/app/_components/SidebarAds";
import {
  HIDDEN_TOPICS,
  LEGACY_FREE_TAG,
  MONTHS_LONG,
  addMonths,
  currentMonth,
  endOfThisWeek,
  findArea,
  listHref,
  monthLabel,
  monthRange,
  pillMonths,
  ukToday,
  weekendLabel,
  weekendRange,
  type ListFilter,
} from "@/lib/event-list";
import {
  SITE_URL,
  dateParts,
  formatTimeRange,
  getOccurrences,
  isRepeating,
  ukInstant,
  upcomingOccurrences,
  venueShort,
  type Occurrence,
} from "@/lib/event-view";
import {
  getAd,
  getFeaturedImage,
  getScEventCategories,
  getScEventTags,
  getScEvents,
  stripHtml,
  type WPScEvent,
  type WPScEventTag,
} from "@/lib/wordpress";
import { ShareEventRow } from "../[slug]/_components/ShareEventRow";
import { CategorySelect } from "./CategorySelect";
import { ChevronIcon, CalendarIcon, StarIcon } from "./EvIcons";
import { EventCard } from "./EventCard";
import { FeaturedSlider, type Slide } from "./FeaturedSlider";
import { LoadMoreGroups } from "./LoadMoreGroups";

interface Item {
  event: WPScEvent;
  occurrence: Occurrence;
}

const PAGE_SIZE = 24;

/** "Free" comes from the new price field; events from before it existed fall back to the old "Free Entry" tag. */
function isFree(event: WPScEvent, tagsById: Map<number, WPScEventTag>): boolean {
  if (event.meta.sc_price_type === "free") return true;
  if (event.meta.sc_price_type === "paid") return false;
  return (event.sc_event_tag ?? []).some((id) => tagsById.get(id)?.slug === LEGACY_FREE_TAG);
}

function hasTopic(event: WPScEvent, topic: string, tagsById: Map<number, WPScEventTag>): boolean {
  if (topic === "free") return isFree(event, tagsById);
  return (event.sc_event_tag ?? []).some((id) => tagsById.get(id)?.slug === topic);
}

/**
 * Every date of every event falling in [from, to), not yet over — or,
 * with includePast, every date full stop (past month pages stay up for
 * search, listing what was on).
 */
function occurrencesBetween(events: WPScEvent[], from: Date, to: Date, now: number, includePast = false): Item[] {
  const items: Item[] = [];
  for (const event of events) {
    for (const occurrence of includePast ? getOccurrences(event) : upcomingOccurrences(event, now)) {
      if (occurrence.start >= from && occurrence.start < to) items.push({ event, occurrence });
    }
  }
  return items.sort((a, b) => a.occurrence.start.getTime() - b.occurrence.start.getTime());
}

/** Each event once, at its next date — repeating events appear once in the main list. */
function nextOccurrences(events: WPScEvent[], now: number): Item[] {
  return events
    .map((event) => ({ event, occurrence: upcomingOccurrences(event, now)[0] }))
    .filter((x): x is Item => Boolean(x.occurrence))
    .sort((a, b) => a.occurrence.start.getTime() - b.occurrence.start.getTime());
}

/** "This week", "Later in October", then by month ("January 2027" once the year changes). */
function groupItems(items: Item[], now: number): Array<{ label: string; items: Item[] }> {
  const weekEnd = endOfThisWeek(now);
  const today = ukToday(now);
  const groups: Array<{ label: string; items: Item[] }> = [];
  for (const item of items) {
    const d = item.occurrence.start;
    let label: string;
    if (d < weekEnd) label = "This week";
    else if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth())
      label = `Later in ${MONTHS_LONG[d.getMonth()]}`;
    else label = d.getFullYear() === today.getFullYear() ? MONTHS_LONG[d.getMonth()] : `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function topicName(topic: string, tags: WPScEventTag[]): string {
  if (topic === "free") return "Free";
  return tags.find((t) => t.slug === topic)?.name ?? topic;
}

/** Page heading and intro line, following the mockup's pageTitle(). */
export function listTitle(filter: ListFilter, tags: WPScEventTag[], now = Date.now()): { title: string; intro: string } {
  const area = findArea(filter.area);
  const where = area ? (area.slug === "whats-on-outside-sutton" ? " outside Sutton" : ` in ${area.name}`) : "";
  let title: string;
  let intro: string;
  if (filter.topic) {
    const name = topicName(filter.topic, tags);
    title = filter.topic === "free" ? `Free events${where}` : `${name} events${where}`;
    intro =
      filter.when !== "all"
        ? ""
        : filter.topic === "free"
        ? "Free things to do, from markets to jam nights."
        : `Upcoming ${name.toLowerCase()} events in and around Carshalton.`;
    if (filter.when !== "all") {
      intro = `Showing ${filter.when === "weekend" ? "this weekend" : monthLabel(filter.when)}.`;
    }
  } else if (filter.when === "weekend") {
    title = `Things to do this weekend${where}`;
    intro = `${weekendLabel(now)}.`;
  } else if (filter.when !== "all") {
    title = area ? `${area.title}, ${monthLabel(filter.when)}` : `What's on in ${monthLabel(filter.when)}`;
    intro =
      filter.when < currentMonth(now)
        ? `Events that took place in and around Carshalton and Sutton in ${monthLabel(filter.when)}.`
        : area
        ? area.intro
        : `Events in and around Carshalton and Sutton in ${monthLabel(filter.when)}.`;
  } else {
    title = area ? area.title : "Events";
    intro = area ? area.intro : "";
  }
  return { title, intro };
}

/** Title, description and social preview for any list page. */
export async function listMetadata(filter: ListFilter): Promise<Metadata> {
  const [tags, events] = await Promise.all([getScEventTags().catch(() => []), getScEvents(300).catch(() => [])]);
  const { title, intro } = listTitle(filter, tags);
  const isMain = !filter.area && filter.when === "all" && !filter.topic;
  const pageTitle = isMain ? "Events — what's on in Carshalton and Sutton" : `${title} — Secret Carshalton`;
  const description = intro || "Things to do in and around Carshalton and Sutton: talks, music, markets, family days out and more.";
  // Social preview image: the first upcoming event with a photo.
  const image = nextOccurrences(events, Date.now())
    .map((i) => getFeaturedImage(i.event))
    .find((img) => img)?.source_url;
  const path = listHref(filter);
  return {
    title: pageTitle,
    description,
    alternates: { canonical: path },
    openGraph: { title: pageTitle, description, url: `${SITE_URL}${path}`, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title: pageTitle, description, images: image ? [image] : undefined },
  };
}


function Grid({ items }: { items: Item[] }) {
  return (
    <div className="evx-grid evx-grid-2">
      {items.map((i) => (
        <EventCard key={`${i.event.id}-${i.occurrence.start.getTime()}`} event={i.event} occurrence={i.occurrence} tone="dark" />
      ))}
    </div>
  );
}

/**
 * Every events list page — main, area, weekend, month and category — is
 * this one component with a different filter, so they can't drift apart.
 * Built as the mockup's "Events list" tab, "Black page" style.
 */
export async function EventsListPage({ filter }: { filter: ListFilter }) {
  const now = Date.now();
  const [allEvents, categories, tags, ad1, ad2, ad3] = await Promise.all([
    getScEvents(300).catch(() => []),
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);
  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const area = findArea(filter.area);
  const areaId = area ? categories.find((c) => c.slug === area.slug)?.id : undefined;
  const inArea = (e: WPScEvent) => !area || (areaId !== undefined && (e.sc_event_category ?? []).includes(areaId));

  const areaEvents = allEvents.filter(inArea);
  const topicEvents = filter.topic ? areaEvents.filter((e) => hasTopic(e, filter.topic!, tagsById)) : areaEvents;

  // What's in the list.
  let items: Item[];
  if (filter.when === "weekend") {
    const { from, to } = weekendRange(now);
    items = occurrencesBetween(topicEvents, from, to, now);
  } else if (filter.when !== "all") {
    const { from, to } = monthRange(filter.when);
    // Month pages list every date in the month — a repeating event appears
    // on each. Past months keep their (finished) events listed, for search.
    items = occurrencesBetween(topicEvents, from, to, now, filter.when < currentMonth(now));
  } else {
    items = nextOccurrences(topicEvents, now);
  }

  // Dropdown: only categories that have something in the current area/when.
  const whenItems =
    filter.when === "all"
      ? nextOccurrences(areaEvents, now)
      : filter.when === "weekend"
      ? occurrencesBetween(areaEvents, weekendRange(now).from, weekendRange(now).to, now)
      : occurrencesBetween(areaEvents, monthRange(filter.when).from, monthRange(filter.when).to, now, filter.when < currentMonth(now));
  const counted = new Set<number>();
  const counts = new Map<string, number>();
  for (const { event } of whenItems) {
    if (counted.has(event.id)) continue;
    counted.add(event.id);
    if (isFree(event, tagsById)) counts.set("free", (counts.get("free") ?? 0) + 1);
    for (const id of event.sc_event_tag ?? []) {
      const slug = tagsById.get(id)?.slug;
      if (slug && !HIDDEN_TOPICS.has(slug)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  const options = [
    ...(counts.get("free") || filter.topic === "free" ? [{ value: "free", label: "Free events", href: listHref({ ...filter, topic: "free" }) }] : []),
    ...tags
      .filter((t) => !HIDDEN_TOPICS.has(t.slug) && (counts.get(t.slug) || filter.topic === t.slug))
      .map((t) => ({ value: t.slug, label: t.name, href: listHref({ ...filter, topic: t.slug }) })),
  ];

  const isHome = !filter.area && filter.when === "all" && !filter.topic;
  const isAreaHome = Boolean(area) && filter.when === "all" && !filter.topic;
  const { title, intro } = listTitle(filter, tags, now);
  const path = listHref(filter);

  // Featured slider: on the main and area pages only. Single events only,
  // dropping out once their date has passed. Area pages show featured
  // events in that area, or all featured events if there are none.
  let slides: Slide[] = [];
  if (isHome || isAreaHome) {
    const featured = (list: WPScEvent[]) =>
      nextOccurrences(list.filter((e) => e.meta.sc_event_featured && !isRepeating(e)), now);
    let picks = featured(areaEvents);
    if (picks.length === 0 && area) picks = featured(allEvents);
    slides = picks.map(({ event, occurrence }) => {
      const p = dateParts(occurrence.start);
      const topicTag = tags.find((t) => event.sc_event_tag?.includes(t.id) && !HIDDEN_TOPICS.has(t.slug));
      return {
        slug: event.slug,
        title: stripHtml(event.title.rendered),
        image: getFeaturedImage(event)?.source_url ?? null,
        weekday: p.weekday,
        day: p.day,
        month: p.month,
        place: venueShort(event) ?? "",
        time: formatTimeRange(occurrence),
        topic: topicTag?.name ?? null,
        targetMs: ukInstant(occurrence.start),
      };
    });
  }

  // The list itself.
  let main: ReactNode;
  if (items.length === 0) {
    const nextUp = nextOccurrences(areaEvents, now).slice(0, 2);
    main = (
      <>
        <div className="evl-empty">
          <h2>Nothing listed here yet</h2>
          <p>Know of something happening? Add it and it goes live straight away.</p>
          <Link className="evl-btn-submit" href="/events/submit">
            Submit an event
          </Link>
        </div>
        {nextUp.length > 0 && (
          <div className="evl-group">
            <h2>Coming up next</h2>
            <Grid items={nextUp} />
          </div>
        )}
      </>
    );
  } else if (filter.when === "all" && !filter.topic) {
    const groups = groupItems(items, now).map((g) => ({
      label: g.label,
      cards: g.items.map((i) => (
        <EventCard key={`${i.event.id}-${i.occurrence.start.getTime()}`} event={i.event} occurrence={i.occurrence} tone="dark" />
      )),
    }));
    main = <LoadMoreGroups groups={groups} pageSize={PAGE_SIZE} />;
  } else {
    main = (
      <LoadMoreGroups
        groups={[
          {
            label: `${items.length} event${items.length === 1 ? "" : "s"}`,
            cards: items.map((i) => (
              <EventCard key={`${i.event.id}-${i.occurrence.start.getTime()}`} event={i.event} occurrence={i.occurrence} tone="dark" />
            )),
          },
        ]}
        pageSize={PAGE_SIZE}
      />
    );
  }

  // Month pages: previous/next month links so every month page can be found.
  let monthNav: ReactNode = null;
  if (filter.when !== "all" && filter.when !== "weekend" && !filter.topic) {
    const prev = addMonths(filter.when, -1);
    const next = addMonths(filter.when, 1);
    // Back as far as the earliest month with an event, so every past month page can be found.
    const firstMonth = allEvents
      .map((e) => getOccurrences(e)[0]?.start)
      .filter((d): d is Date => Boolean(d))
      .reduce<string | null>((min, d) => {
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return !min || m < min ? m : min;
      }, null);
    const showPrev = Boolean(firstMonth && prev >= firstMonth);
    const showNext = next <= addMonths(currentMonth(now), 12);
    monthNav = (
      <nav className="evl-month-nav" aria-label="Other months">
        {showPrev ? (
          <Link className="evx-btn-dark" href={listHref({ ...filter, when: prev })}>
            ← {monthLabel(prev)}
          </Link>
        ) : (
          <span />
        )}
        {showNext && (
          <Link className="evx-btn-dark" href={listHref({ ...filter, when: next })}>
            {monthLabel(next)} →
          </Link>
        )}
      </nav>
    );
  }

  // "Latest events added" — main page only.
  const latest = isHome
    ? [...allEvents]
        .filter((e) => upcomingOccurrences(e, now).length > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
    : [];

  const pills: Array<{ when: string; label: string; icon?: "star" | "cal" }> = [
    { when: "all", label: "All upcoming" },
    { when: "weekend", label: "This weekend", icon: "star" },
    ...pillMonths(now).map((m) => ({ when: m, label: monthLabel(m, false), icon: "cal" as const })),
  ];
  // A month page outside the pill range still gets its own pill, so the active state shows.
  if (filter.when !== "all" && filter.when !== "weekend" && !pills.some((p) => p.when === filter.when)) {
    pills.push({ when: filter.when, label: monthLabel(filter.when), icon: "cal" });
  }

  const backHref = area ? listHref({ area: area.slug, when: "all" }) : "/events";
  const showBack = !isHome && Boolean(filter.topic || filter.when !== "all");

  return (
    <main className="evx evl">
      {showBack && (
        <div className="evl-sub-head">
          <Link href={backHref} className="evx-back">
            <ChevronIcon />
            {area ? area.title : "All events"}
          </Link>
        </div>
      )}

      <div className="evl-head">
        <div>
          <h1 className={isHome ? "evl-big" : undefined}>
            {title}
            {isHome && <CategoryKeyIcon />}
          </h1>
          {intro && <p className="evl-intro">{intro}</p>}
        </div>
        {isHome ? (
          <Link className="evl-btn-submit" href="/events/submit">
            Submit an event
          </Link>
        ) : (
          <div className="evl-share">
            <span>Share</span>
            <ShareEventRow path={path} title={title} />
          </div>
        )}
      </div>

      <div className="evl-fbar" role="navigation" aria-label="Filter events">
        <div className="evl-frow">
          {pills.map((p) => {
            const on = filter.when === p.when;
            return (
              <Link
                key={p.when}
                href={listHref({ ...filter, when: p.when })}
                className={`evl-chip${on ? " evl-chip-on" : ""}`}
                aria-current={on ? "page" : undefined}
              >
                {p.icon === "star" && <StarIcon />}
                {p.icon === "cal" && <CalendarIcon />}
                {p.label}
              </Link>
            );
          })}
        </div>
        <CategorySelect
          options={options}
          value={filter.topic ?? ""}
          allHref={listHref({ ...filter, topic: null })}
        />
      </div>

      {slides.length > 0 && <FeaturedSlider slides={slides} />}

      <div className="evl-layout">
        <div className="evl-main">
          {main}
          {monthNav}
        </div>
        <aside className="evl-side">
          <SidebarAds ads={[ad1, ad2, ad3]} />
        </aside>
      </div>

      {latest.length > 0 && (
        <section className="evl-latest">
          <h2>Latest events added</h2>
          <div className="evl-hscroll">
            {latest.map((event) => {
              const image = getFeaturedImage(event);
              const next = upcomingOccurrences(event, now)[0] ?? getOccurrences(event)[0];
              const p = next ? dateParts(next.start) : null;
              return (
                <Link key={event.id} className="evl-mini" href={`/events/${event.slug}`}>
                  <div className="evx-card-img evl-mini-img">
                    {image ? <img src={image.source_url} alt="" loading="lazy" /> : <div className="evx-card-noimg" />}
                  </div>
                  <div className="evl-mini-t">
                    {p && <span className="evl-mini-d">{p.label.replace(/ \d{4}$/, "")}</span>}
                    <h3>{stripHtml(event.title.rendered)}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

