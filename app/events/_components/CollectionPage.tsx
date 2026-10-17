import type { Metadata } from "next";
import Link from "next/link";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { ShareRow } from "@/app/_components/ShareRow";
import type { COLLECTIONS } from "@/lib/event-list";
import { SITE_URL, getOccurrences, upcomingOccurrences, type Occurrence } from "@/lib/event-view";
import {
  getAd,
  getFeaturedImage,
  getScEventTags,
  getScEvents,
  type WPScEvent,
  soft,
} from "@/lib/wordpress";
import { ChevronIcon } from "./EvIcons";
import { EventCard } from "./EventCard";

type Collection = (typeof COLLECTIONS)[number];
type Item = { event: WPScEvent; occurrence: Occurrence };

async function taggedEvents(collection: Collection): Promise<WPScEvent[]> {
  const [events, tags] = await Promise.all([getScEvents(300).catch(soft([])), getScEventTags().catch(soft([]))]);
  const tag = tags.find((t) => t.slug === collection.slug);
  return tag ? events.filter((e) => (e.sc_event_tag ?? []).includes(tag.id)) : [];
}

/**
 * Coming up: each event once, at its next date, soonest first. Then the
 * ones that have already happened, most recent first, at their last
 * date: they stay on the page instead of dropping off it.
 */
function split(events: WPScEvent[], now: number): { upcoming: Item[]; past: Item[] } {
  const upcoming: Item[] = [];
  const past: Item[] = [];
  for (const event of events) {
    const next = upcomingOccurrences(event, now)[0];
    if (next) {
      upcoming.push({ event, occurrence: next });
    } else {
      const last = getOccurrences(event).at(-1);
      if (last) past.push({ event, occurrence: last });
    }
  }
  upcoming.sort((a, b) => a.occurrence.start.getTime() - b.occurrence.start.getTime());
  past.sort((a, b) => b.occurrence.start.getTime() - a.occurrence.start.getTime());
  return { upcoming, past };
}

export async function collectionMetadata(collection: Collection): Promise<Metadata> {
  const events = await taggedEvents(collection);
  const { upcoming, past } = split(events, Date.now());
  const image = collection.image
    ? `${SITE_URL}${collection.image}`
    : [...upcoming, ...past].map((i) => getFeaturedImage(i.event)).find((img) => img)?.source_url;
  const path = `/events/${collection.slug}`;
  const title = `${collection.title} — Secret Carshalton`;
  return {
    title,
    description: collection.intro,
    alternates: { canonical: path },
    openGraph: { title, description: collection.intro, url: `${SITE_URL}${path}`, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description: collection.intro, images: image ? [image] : undefined },
  };
}

function Grid({ items }: { items: Item[] }) {
  return (
    <div className="evx-grid evx-grid-2">
      {items.map((i) => (
        <EventCard key={i.event.id} event={i.event} occurrence={i.occurrence} tone="dark" />
      ))}
    </div>
  );
}

/** A seasonal collection page, e.g. /events/halloween-2026 (see COLLECTIONS). */
export async function CollectionPage({ collection }: { collection: Collection }) {
  const [events, ad1, ad2, ad3] = await Promise.all([
    taggedEvents(collection),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);
  const { upcoming, past } = split(events, Date.now());
  const path = `/events/${collection.slug}`;

  return (
    <main className="evx evl">
      <div className="evl-sub-head">
        <Link href="/events" className="evx-back">
          <ChevronIcon />
          All events
        </Link>
      </div>

      <div className="evl-head">
        <div>
          <h1>{collection.title}</h1>
          <p className="evl-intro">{collection.intro}</p>
        </div>
        <div className="evl-share">
          <span>Share</span>
          <ShareRow path={path} title={collection.title} />
        </div>
      </div>

      <div className="evl-layout">
        <div className="evl-main">
          {upcoming.length === 0 && past.length === 0 && (
            <div className="evl-empty">
              <h2>Nothing listed here yet</h2>
              <p>Know of something happening? Add it and it goes live straight away.</p>
              <Link className="evl-btn-submit" href="/events/submit">
                Submit an event
              </Link>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="evl-group">
              <h2>Coming up</h2>
              <Grid items={upcoming} />
            </div>
          )}
          {past.length > 0 && (
            <div className="evl-group evl-collection-past">
              <h2>Already happened</h2>
              <Grid items={past} />
            </div>
          )}
        </div>
        <aside className="evl-side">
          <SidebarAds ads={[ad1, ad2, ad3]} />
        </aside>
      </div>
    </main>
  );
}
