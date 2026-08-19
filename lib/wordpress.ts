const WP_BASE = "https://www.secretcarshalton.com/wp-json/wp/v2";
const REVALIDATE_SECONDS = 3600;

type WPRendered = { rendered: string };

export interface WPContentItem {
  id: number;
  slug: string;
  date: string;
  link: string;
  title: WPRendered;
  excerpt: WPRendered;
  content: WPRendered;
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
    `/posts?per_page=${perPage}&_fields=id,slug,date,link,title,excerpt,content`
  );
}

export async function getPostBySlug(slug: string): Promise<WPContentItem | null> {
  const posts = await wpFetch<WPContentItem[]>(`/posts?slug=${encodeURIComponent(slug)}`);
  return posts[0] ?? null;
}

export async function getPageBySlug(slug: string): Promise<WPContentItem | null> {
  const pages = await wpFetch<WPContentItem[]>(`/pages?slug=${encodeURIComponent(slug)}`);
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
    `/ajde_events?per_page=${perPage}&_fields=id,slug,date,link,title,excerpt,content`
  );
}

export async function getEventBySlug(slug: string): Promise<WPContentItem | null> {
  const events = await wpFetch<WPContentItem[]>(`/ajde_events?slug=${encodeURIComponent(slug)}`);
  return events[0] ?? null;
}

export function getAllEventSlugs() {
  return getAllSlugs("ajde_events");
}

/**
 * EventON's date/venue meta isn't exposed via REST, but every event's
 * live page carries a schema.org Event block with exactly that data.
 * Scraping this until events are migrated to a post type we control.
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
