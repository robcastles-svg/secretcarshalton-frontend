const WP_BASE = "https://www.secretcarshalton.com/wp-json/wp/v2";
const REVALIDATE_SECONDS = 3600;

type WPRendered = { rendered: string };

export interface WPFeaturedMedia {
  source_url: string;
  alt_text: string;
}

export interface WPContentItem {
  id: number;
  slug: string;
  date: string;
  link: string;
  title: WPRendered;
  excerpt: WPRendered;
  content: WPRendered;
  featured_media?: number;
  _embedded?: {
    "wp:featuredmedia"?: WPFeaturedMedia[];
  };
}

export interface EventSchema {
  startDate?: string;
  endDate?: string;
  location?: Array<{
    name?: string;
    address?: { streetAddress?: string };
  }>;
  organizer?: Array<{ name?: string; url?: string }>;
}

export function getFeaturedImage(item: WPContentItem): WPFeaturedMedia | null {
  return item._embedded?.["wp:featuredmedia"]?.[0] ?? null;
}

/**
 * EventON's startDate/endDate strings aren't valid ISO 8601 (unpadded
 * month/day, offset like "+0:00"), so `new Date()` rejects them outright.
 * Read the Y-M-D-H-Min digits directly instead of relying on Date parsing.
 */
export function parseEventDate(raw?: string): Date | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

async function wpFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${WP_BASE}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`WordPress fetch failed: ${path} -> ${res.status}`);
  }
  return res.json();
}

async function getAllSlugs(postType: string): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  while (true) {
    const items = await wpFetch<Array<{ slug: string }>>(
      `/${postType}?per_page=100&page=${page}&_fields=slug`
    );
    if (items.length === 0) break;
    slugs.push(...items.map((item) => item.slug));
    if (items.length < 100) break;
    page++;
  }
  return slugs;
}

export function getPosts(perPage = 12) {
  return wpFetch<WPContentItem[]>(
    `/posts?per_page=${perPage}&_fields=id,slug,date,link,title,excerpt,content,featured_media,_links&_embed=wp:featuredmedia`
  );
}

export async function getPostBySlug(slug: string): Promise<WPContentItem | null> {
  const posts = await wpFetch<WPContentItem[]>(
    `/posts?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`
  );
  return posts[0] ?? null;
}

export async function getPageBySlug(slug: string): Promise<WPContentItem | null> {
  const pages = await wpFetch<WPContentItem[]>(
    `/pages?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`
  );
  return pages[0] ?? null;
}

export function getAllPostSlugs() {
  return getAllSlugs("posts");
}

export function getAllPageSlugs() {
  return getAllSlugs("pages");
}

export function getEvents(perPage = 100) {
  return wpFetch<WPContentItem[]>(
    `/ajde_events?per_page=${perPage}&_fields=id,slug,date,link,title,excerpt,content,featured_media,_links&_embed=wp:featuredmedia`
  );
}

export async function getEventBySlug(slug: string): Promise<WPContentItem | null> {
  const events = await wpFetch<WPContentItem[]>(
    `/ajde_events?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`
  );
  return events[0] ?? null;
}

export function getAllEventSlugs() {
  return getAllSlugs("ajde_events");
}

/**
 * EventON's date/venue meta isn't exposed via REST, so it's pulled from
 * the schema.org JSON-LD block on each event's live page instead, until
 * events move to a post type we control directly.
 */
export async function getEventSchema(slug: string): Promise<EventSchema | null> {
  const res = await fetch(`https://www.secretcarshalton.com/events/${slug}/`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "Event") return data;
    } catch {
      continue;
    }
  }
  return null;
}
