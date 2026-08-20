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

/**
 * When featured_media points to a deleted/invalid attachment, WP's _embed
 * still populates wp:featuredmedia — but with a WP_Error shape ({code,
 * message, data}) instead of omitting the key. Guard on source_url so a
 * stale reference renders as no image, not a broken <img>.
 */
export function getFeaturedImage(item: WPContentItem): WPFeaturedMedia | null {
  const media = item._embedded?.["wp:featuredmedia"]?.[0];
  return media && "source_url" in media ? media : null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * The WP host (SiteGround shared hosting, no REST API caching layer)
 * intermittently drops connections or stalls past the connect timeout,
 * seemingly under its own concurrency limits — a single failure
 * otherwise aborts the entire `next build`. Retry transient network
 * failures and 5xx responses before giving up.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 6
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function wpFetch<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${WP_BASE}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`WordPress fetch failed: ${path} -> ${res.status}`);
  }
  return res.json();
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

export interface WPCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
  parent: number;
}

export function getCategories() {
  return wpFetch<WPCategory[]>(`/categories?per_page=100&hide_empty=false`);
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const categories = await wpFetch<WPCategory[]>(
    `/categories?slug=${encodeURIComponent(slug)}`
  );
  return categories[0] ?? null;
}

export async function getPostsByCategory(categoryId: number): Promise<WPContentItem[]> {
  const posts: WPContentItem[] = [];
  let page = 1;
  while (true) {
    const batch = await wpFetch<WPContentItem[]>(
      `/posts?categories=${categoryId}&per_page=100&page=${page}&_fields=id,slug,date,link,title,excerpt,content,featured_media,_links&_embed=wp:featuredmedia`
    );
    posts.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return posts;
}

/**
 * EventON's date/venue meta isn't exposed via REST, so it's pulled from
 * the schema.org JSON-LD block on each event's live page instead, until
 * events move to a post type we control directly.
 */
export async function getEventSchema(slug: string): Promise<EventSchema | null> {
  const res = await fetchWithRetry(`https://www.secretcarshalton.com/events/${slug}/`, {
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
