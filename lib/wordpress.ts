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
  attempts = 9
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

/** Matches the real site's search scope: stories, news, and walks — all of which are posts. */
export function searchPosts(query: string, perPage = 20) {
  return wpFetch<WPContentItem[]>(
    `/posts?search=${encodeURIComponent(query)}&per_page=${perPage}&_fields=id,slug,date,link,title,excerpt,content,featured_media,_links&_embed=wp:featuredmedia`
  );
}

export async function getRecentPostSlugs(count: number): Promise<string[]> {
  const posts = await wpFetch<Array<{ slug: string }>>(`/posts?per_page=${count}&_fields=slug`);
  return posts.map((p) => p.slug);
}

export async function getAllPageSlugs(): Promise<string[]> {
  const pages = await wpFetch<Array<{ slug: string }>>(`/pages?per_page=100&_fields=slug`);
  return pages.map((p) => p.slug);
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

export async function getRecentEventSlugs(count: number): Promise<string[]> {
  const events = await wpFetch<Array<{ slug: string }>>(
    `/ajde_events?per_page=${count}&_fields=slug`
  );
  return events.map((e) => e.slug);
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

/** Latest post across a set of category IDs (WP's categories param ORs a comma list). */
export async function getLatestPostInCategories(
  categoryIds: number[]
): Promise<WPContentItem | null> {
  if (categoryIds.length === 0) return null;
  const posts = await wpFetch<WPContentItem[]>(
    `/posts?categories=${categoryIds.join(",")}&per_page=1&_fields=id,slug,date,link,title,excerpt,content,featured_media,_links&_embed=wp:featuredmedia`
  );
  return posts[0] ?? null;
}

export interface WPComment {
  id: number;
  post: number;
  author_name: string;
  content: WPRendered;
  date: string;
}

/**
 * Comments left by the site owner posting as "Secret Carshalton" are
 * filtered out — matches the live site's own behaviour of hiding admin
 * replies from the comments widget.
 */
export async function getLatestComments(count: number): Promise<
  Array<WPComment & { postSlug: string; postTitle: string }>
> {
  const comments = await wpFetch<WPComment[]>(
    `/comments?per_page=${count * 3}&orderby=date&order=desc&_fields=id,post,author_name,content,date`
  );
  const real = comments.filter((c) => c.author_name !== "Secret Carshalton").slice(0, count);
  if (real.length === 0) return [];

  const postIds = Array.from(new Set(real.map((c) => c.post)));
  const posts = await wpFetch<Array<{ id: number; slug: string; title: WPRendered }>>(
    `/posts?include=${postIds.join(",")}&per_page=${postIds.length}&_fields=id,slug,title`
  );
  const postById = new Map(posts.map((p) => [p.id, p]));

  return real
    .map((c) => {
      const post = postById.get(c.post);
      return post ? { ...c, postSlug: post.slug, postTitle: post.title.rendered } : null;
    })
    .filter((c): c is WPComment & { postSlug: string; postTitle: string } => c !== null);
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
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * instead of firing every call simultaneously via Promise.all. Scraping
 * dozens of live event pages in one burst is exactly the kind of
 * concurrency spike that trips the WP host's connection limits.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
