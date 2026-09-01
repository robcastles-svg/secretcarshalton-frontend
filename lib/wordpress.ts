const WP_BASE = "https://www.secretcarshalton.com/wp-json/wp/v2";
const REVALIDATE_SECONDS = 3600;

/**
 * The custom sc-membership/sc-directory/sc-events/sc-ads plugins only
 * exist on the staging clone so far, not the live site — they're new
 * (built this session) and not something to push to production without
 * Rob reviewing them first. Once approved, this becomes WP_BASE's host.
 */
const WP_STAGING_ROOT = "https://www.staging19.secretcarshalton.com/wp-json";

type WPRendered = { rendered: string };

export interface WPFeaturedMedia {
  source_url: string;
  alt_text: string;
}

/**
 * Yoast SEO (active on the live site) injects this into every post/page's
 * REST response automatically — no _fields restriction needed, it's just
 * been sitting unread. It carries whatever an editor customised in the
 * Yoast metabox: a hand-tuned title/description, a dedicated social share
 * image (can differ from the featured image — see the "tree-og.jpg" case
 * that's exactly why this exists), canonical, and noindex/nofollow. Only
 * the fields this frontend actually reads are typed; Yoast's payload has
 * many more (schema graph, breadcrumbs, etc.) left alone for now.
 */
export interface WPYoastHead {
  title?: string;
  description?: string;
  robots?: { index?: string; follow?: string };
  og_title?: string;
  og_description?: string;
  og_image?: Array<{ url: string }>;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
}

export interface WPContentItem {
  id: number;
  slug: string;
  date: string;
  // Not requested by every caller (see each _fields list) — only reliably
  // present via getPostBySlug, which is the one place it's shown.
  modified?: string;
  link: string;
  title: WPRendered;
  excerpt: WPRendered;
  content: WPRendered;
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  // Not a real WP REST field — attached by attachCommentCounts() after the
  // fact via core's own /comments endpoint. Only present on results from
  // functions that call it (getPosts, getPostsByCategory, getPostsByTag).
  comment_count?: number;
  yoast_head_json?: WPYoastHead;
  _embedded?: {
    "wp:featuredmedia"?: WPFeaturedMedia[];
  };
}

/**
 * When featured_media points to a deleted/invalid attachment, WP's _embed
 * still populates wp:featuredmedia — but with a WP_Error shape ({code,
 * message, data}) instead of omitting the key. Guard on source_url so a
 * stale reference renders as no image, not a broken <img>.
 *
 * Typed against just the _embedded shape (not the full WPContentItem) so
 * it also works for sc-directory/sc-events items, which carry the same
 * _embed convention but aren't posts/pages.
 */
export function getFeaturedImage(item: {
  _embedded?: { "wp:featuredmedia"?: WPFeaturedMedia[] };
}): WPFeaturedMedia | null {
  const media = item._embedded?.["wp:featuredmedia"]?.[0];
  return media && "source_url" in media ? media : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Like stripHtml, but for round-tripping wpautop'd content.rendered back
 * into a plain textarea (the event edit form) without flattening it to a
 * single line — </p> and <br> become real newlines first, so blank-line
 * paragraph breaks survive being re-submitted through wp_kses_post and
 * re-wpautop'd on the next render, the same way they did on first submit.
 */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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
 *
 * Every attempt gets a hard 15s bound by default (callers can still pass
 * their own `signal` to override it). Originally this had no timeout and
 * defaulted to 9 attempts — worst case, over 2 minutes of retrying before
 * finally rejecting, which blows past Next's own per-page build timeout
 * and kills the whole export before any caller's `.catch()` gets a chance
 * to help. That silently took down /events and then / (homepage) on two
 * separate deploys before this was fixed at the source instead of
 * per-call-site (see bb5b5ba, 06e2353, ac88a2b for the earlier ad hoc
 * fixes this generalizes).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), ...init });
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

/**
 * comment_count isn't a field core exposes on the post REST object (it's a
 * wp_posts column, not registered for REST) — and there's no plugin on the
 * live site (where these posts actually live) to add it either. Core's own
 * /comments endpoint already returns only approved comments to logged-out
 * requests, same as the comment_count column would, so tallying those by
 * post id gets a real count with no plugin changes needed.
 */
async function attachCommentCounts(posts: WPContentItem[]): Promise<WPContentItem[]> {
  if (posts.length === 0) return posts;
  const counts = new Map<number, number>();
  const ids = posts.map((p) => p.id);

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    let page = 1;
    while (true) {
      const batch = await wpFetch<{ post: number }[]>(
        `/comments?post=${chunk.join(",")}&per_page=100&page=${page}&_fields=post`
      ).catch(() => []);
      for (const c of batch) counts.set(c.post, (counts.get(c.post) ?? 0) + 1);
      if (batch.length < 100) break;
      page++;
    }
  }

  return posts.map((p) => ({ ...p, comment_count: counts.get(p.id) ?? 0 }));
}

export async function getPosts(perPage = 12) {
  const posts = await wpFetch<WPContentItem[]>(
    `/posts?per_page=${perPage}&_fields=id,slug,date,link,title,excerpt,content,featured_media,_links&_embed=wp:featuredmedia`
  );
  return attachCommentCounts(posts);
}

/**
 * Our own view counter (sc-post-views, staging), not the third-party
 * Post Views Counter plugin's REST API — that one only ever answers "this
 * post's all-time total" (one request per post, no time window, no "top
 * posts" of any kind), which is why the homepage's "top stories" used to
 * need a request per candidate post and could only ever be "top of the
 * last 20", not genuinely "this week". sc-post-views keeps a daily bucket
 * per post (seeded from Post Views Counter's numbers so nothing reset to
 * zero when this switched over — see its admin backfill), so both
 * problems go away: getPostViewCount is one request, and getTopPosts
 * below answers "today"/"this week" directly, already sorted.
 */
export async function getPostViewCount(postId: number): Promise<number> {
  try {
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-post-views/v1/count/${postId}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return 0;
    const body = await res.json();
    return typeof body.views === "number" ? body.views : 0;
  } catch {
    return 0;
  }
}

/** Fire-and-forget: tells sc-post-views a real page view just happened. See PostViewTracker. */
export async function recordPostView(postId: number, slug: string, title: string): Promise<void> {
  try {
    await fetch(`${WP_STAGING_ROOT}/sc-post-views/v1/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, slug, title }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Losing an occasional view count isn't worth failing anything over.
  }
}

export interface TopViewedPost {
  post_id: number;
  slug: string;
  title: string;
  views: number;
}

async function getTopPosts(window: "today" | "week", limit: number): Promise<TopViewedPost[]> {
  try {
    // sc-post-views also tracks events and directory listings (same view
    // counter, different post types), and a plain post could be a
    // Spotlight/People article — none of which belong in a "Top stories"
    // widget, and events/listings would even build a broken /${slug} link
    // here (their real URL needs a /events/ or /directory/ prefix this
    // component doesn't know to add). post_type=post plus this specific
    // category list keeps it to what these widgets are actually labelled:
    // "Top stories".
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-post-views/v1/top?window=${window}&limit=${limit}&post_type=post&categories=news,stories,walks`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function getTopPostsToday(limit: number): Promise<TopViewedPost[]> {
  return getTopPosts("today", limit);
}

export function getTopPostsThisWeek(limit: number): Promise<TopViewedPost[]> {
  return getTopPosts("week", limit);
}

export async function getRecentPostSlugs(count: number): Promise<string[]> {
  const posts = await wpFetch<Array<{ slug: string }>>(`/posts?per_page=${count}&_fields=slug`);
  return posts.map((p) => p.slug);
}

export async function getAllPageSlugs(): Promise<string[]> {
  const pages = await wpFetch<Array<{ slug: string }>>(`/pages?per_page=100&_fields=slug`);
  return pages.map((p) => p.slug);
}

/**
 * Every post slug + last-modified date, for the sitemap. Paginated, capped
 * well above the real post count. A sitemap is low-stakes — worth having
 * fresh, never worth failing a deploy over — so a failed page stops the
 * pagination and returns whatever was gathered so far instead of retrying
 * through potentially many minutes of backoff across up to 30 pages.
 */
export async function getAllPostSlugs(): Promise<Array<{ slug: string; modified: string }>> {
  const all: Array<{ slug: string; modified: string }> = [];
  for (let page = 1; page <= 30; page++) {
    try {
      const batch = await wpFetch<Array<{ slug: string; modified: string }>>(
        `/posts?per_page=100&page=${page}&_fields=slug,modified`
      );
      all.push(...batch);
      if (batch.length < 100) break;
    } catch {
      break;
    }
  }
  return all;
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

const NAV_SECTION_BY_TOP_CATEGORY_SLUG: Record<string, string> = {
  news: "News",
  stories: "Discover",
  walks: "Walks",
  people: "Discover",
};

/**
 * A post's category doesn't appear in its flat /{slug} URL, so the main
 * nav (which highlights by pathname) can't tell which section a given
 * article belongs to on its own — this maps the post's own category ids
 * to the top-level nav section, checking both a direct match (news,
 * people — flat, no children) and one level up (a story's own category is
 * an area like "Beddington", a child of the "stories" parent category).
 * Used by SetActiveNavSection on the post page.
 */
export function navSectionForCategories(
  postCategoryIds: number[] | undefined,
  allCategories: WPCategory[]
): string | null {
  if (!postCategoryIds?.length) return null;
  const byId = new Map(allCategories.map((c) => [c.id, c] as const));
  for (const catId of postCategoryIds) {
    const cat = byId.get(catId);
    if (!cat) continue;
    if (NAV_SECTION_BY_TOP_CATEGORY_SLUG[cat.slug]) return NAV_SECTION_BY_TOP_CATEGORY_SLUG[cat.slug];
    const parent = byId.get(cat.parent);
    if (parent && NAV_SECTION_BY_TOP_CATEGORY_SLUG[parent.slug]) {
      return NAV_SECTION_BY_TOP_CATEGORY_SLUG[parent.slug];
    }
  }
  return null;
}

/**
 * Where a "place" (category) badge on a card should click through to —
 * mirrors navSectionForCategories' own top-level/one-level-up logic, but
 * returns an actual URL instead of a nav-section label. An area category
 * (a child of "stories" or "walks") goes to its own real page; "news" and
 * "people" are flat categories with their own listing pages; anything
 * else falls back to Discover, which is the closest thing to a general
 * "everything" category browse this site has.
 */
export function categoryHref(category: WPCategory, categoriesById: Map<number, WPCategory>): string {
  if (category.slug === "news") return "/news";
  if (category.slug === "people") return "/people";
  if (category.slug === "stories") return "/discover";
  if (category.slug === "walks") return "/walks";
  const parent = categoriesById.get(category.parent);
  if (parent?.slug === "stories") return `/stories/${category.slug}`;
  if (parent?.slug === "walks") return `/walks/${category.slug}`;
  return "/discover";
}

export interface WPTag {
  id: number;
  slug: string;
  name: string;
  count?: number;
}

export function getTags() {
  return wpFetch<WPTag[]>(`/tags?per_page=100&hide_empty=false`);
}

export async function getTagBySlug(slug: string): Promise<WPTag | null> {
  const tags = await wpFetch<WPTag[]>(`/tags?slug=${encodeURIComponent(slug)}`);
  return tags[0] ?? null;
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
  // Optional: getLatestComments doesn't request this field (it doesn't
  // need it), so it's only reliably present via getCommentsForPost.
  author?: number;
  author_name: string;
  content: WPRendered;
  date: string;
  // 1-5, only ever set on directory-listing reviews — see sc-membership's
  // register_rest_field('comment', 'rating', ...). null/absent elsewhere.
  rating?: number | null;
}

/**
 * Real (non-admin) comments on a single post, newest first. Reads from
 * staging (scDirectoryFetch), not the live site — sc-events/sc-listings
 * only exist on staging, so a post there has no matching ID on live at
 * all (comments would always read back empty); staging also carries a
 * full mirror of live's historical post comments, and it's where every
 * new member comment actually gets written (submitComment always posts
 * to WP_STAGING_ROOT), so reading from the same place as the write
 * target is what makes a just-submitted comment actually reappear.
 */
export async function getCommentsForPost(postId: number, count: number): Promise<WPComment[]> {
  const comments = await scDirectoryFetch<WPComment[]>(
    `/comments?post=${postId}&per_page=${count * 2}&orderby=date&order=desc&_fields=id,post,author,author_name,content,date,rating`
  );
  return comments.filter((c) => c.author_name !== "Secret Carshalton").slice(0, count);
}

/**
 * Batch id -> profile lookup for a comment thread's authors, so a
 * commenter's name/icon can link to their public member profile. WP
 * core's /wp/v2/users blocks anonymous listing outright
 * ("rest_user_cannot_view"), hence the dedicated sc-membership route.
 * Guest/anonymous comments (author id 0) and staff/pending-review
 * accounts simply won't appear in the result — callers should render
 * those as plain text, same as today.
 */
export async function getMembersByIds(
  ids: number[]
): Promise<Map<number, { slug: string; name: string; avatar: string; joinedAt: string }>> {
  const realIds = Array.from(new Set(ids.filter((id) => id > 0)));
  if (realIds.length === 0) return new Map();
  try {
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-membership/v1/members-by-id?ids=${realIds.join(",")}`,
      { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return new Map();
    const members: Array<{ id: number; slug: string; name: string; avatar: string; joined_at: string }> =
      await res.json();
    return new Map(members.map((m) => [m.id, { slug: m.slug, name: m.name, avatar: m.avatar, joinedAt: m.joined_at }]));
  } catch {
    return new Map();
  }
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

export interface PublicComment {
  id: number;
  content: WPRendered;
  date: string;
  post_type: string | null;
  post_slug: string | null;
  post_title: string | null;
}

/** Maps a post_type + slug to the frontend route it lives at — the one thing WP's own post_type name can't tell you. */
export function linkForPostType(postType: string | null, slug: string | null): string | null {
  if (!slug) return null;
  if (postType === "sc_event") return `/events/${slug}`;
  if (postType === "sc_listing") return `/directory/${slug}`;
  return `/${slug}`;
}

/**
 * Public, unauthenticated — approved comments only (see
 * SC_Membership_REST::get_comments_by_user's docblock). Powers the "their
 * comments" section on a member's public profile page.
 */
export async function getCommentsByUser(
  userId: number
): Promise<Array<PublicComment & { link: string | null }>> {
  try {
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-membership/v1/comments-by-user?user_id=${userId}`,
      { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return [];
    const comments: PublicComment[] = await res.json();
    return comments.map((c) => ({ ...c, link: linkForPostType(c.post_type, c.post_slug) }));
  } catch {
    return [];
  }
}

export async function getPostsByCategory(categoryId: number): Promise<WPContentItem[]> {
  const posts: WPContentItem[] = [];
  let page = 1;
  while (true) {
    const batch = await wpFetch<WPContentItem[]>(
      `/posts?categories=${categoryId}&per_page=100&page=${page}&_fields=id,slug,date,link,title,excerpt,content,featured_media,categories,tags,_links&_embed=wp:featuredmedia`
    );
    posts.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return attachCommentCounts(posts);
}

/**
 * Multiple category ids OR'd together (WP REST's comma-separated
 * `categories` param) — Discover's merged feed of every area under
 * Stories in one request, rather than N separate area fetches. Capped at
 * maxResults since this is a browsing feed, not an archive — most
 * recent first (WP's own default order).
 */
export async function getPostsByCategories(categoryIds: number[], maxResults = 40): Promise<WPContentItem[]> {
  if (categoryIds.length === 0) return [];
  const posts: WPContentItem[] = [];
  let page = 1;
  while (posts.length < maxResults) {
    const batch = await wpFetch<WPContentItem[]>(
      `/posts?categories=${categoryIds.join(",")}&per_page=100&page=${page}&_fields=id,slug,date,link,title,excerpt,content,featured_media,categories,tags,_links&_embed=wp:featuredmedia`
    );
    posts.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return attachCommentCounts(posts.slice(0, maxResults));
}

/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * instead of firing every call simultaneously via Promise.all. Scraping
 * dozens of live event pages in one burst is exactly the kind of
 * concurrency spike that trips the WP host's connection limits.
 */
/**
 * "Stories by theme" — the site's tag taxonomy repurposed as browsable
 * theme pages (the brief's homepage notes describe this feature without
 * it existing anywhere on the reference site to copy from).
 */
export async function getPostsByTag(tagId: number): Promise<WPContentItem[]> {
  const posts: WPContentItem[] = [];
  let page = 1;
  while (true) {
    const batch = await wpFetch<WPContentItem[]>(
      `/posts?tags=${tagId}&per_page=100&page=${page}&_fields=id,slug,date,link,title,excerpt,content,featured_media,categories,tags,_links&_embed=wp:featuredmedia`
    );
    posts.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return attachCommentCounts(posts);
}

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

// ---------------------------------------------------------------------------
// sc-ads — admin-manageable ad slots (staging only, see WP_STAGING_ROOT note)
// ---------------------------------------------------------------------------

export interface WPAd {
  id: number;
  image: string;
  link: string;
  alt: string;
  headline?: string;
  body?: string;
}

/**
 * Deliberately uncached (`cache: "no-store"`) — sc-ads now picks a
 * weighted-random ad per call, matching how AdRotate itself re-rolls on
 * every page load. The pages that show ads are still ISR (revalidate
 * 3600), so a cached fetch here would freeze the same ad for the whole
 * revalidation window; this is called from the /api/ads/active proxy
 * route, which the AdSlot client component hits on every pageview, so
 * rotation stays genuinely per-visit rather than per-ISR-window.
 * Never allowed to fail the page it's on — an ad slot is decoration, not content.
 */
export async function getAd(placement: string): Promise<WPAd | null> {
  try {
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-ads/v1/active/${placement}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Splits wpautop'd content HTML into a sequence of block-level chunks
 * (after each closing </p>, list, blockquote or heading tag) so the
 * frontend can interleave in-article ad slots between them — the way
 * groups 5 and 7 sat embedded mid-article on the live AdRotate setup,
 * rather than only ever wrapping the article as a single opaque blob.
 */
export function splitContentIntoParagraphChunks(html: string): string[] {
  const parts = html.split(/(<\/p>|<\/ul>|<\/ol>|<\/blockquote>|<\/h[1-6]>)/i);
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    current += part;
    if (/^<\/(p|ul|ol|blockquote|h[1-6])>$/i.test(part)) {
      chunks.push(current);
      current = "";
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/** Increments the click counter server-side and hands back the real link to redirect to. */
export async function recordAdClick(adId: number): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-ads/v1/click/${adId}`,
      { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.link || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// sc-directory — business directory (staging only, see WP_STAGING_ROOT note)
// ---------------------------------------------------------------------------

export interface WPListingMeta {
  sc_address_street: string;
  sc_address_town: string;
  sc_address_region: string;
  sc_address_postcode: string;
  sc_address_country: string;
  sc_website: string;
  sc_phone: string;
  sc_email: string;
  sc_tagline: string;
  sc_facebook: string;
  sc_instagram: string;
  sc_twitter: string;
  sc_linkedin: string;
  sc_youtube: string;
  sc_lat: string;
  sc_lng: string;
  sc_featured: boolean;
  sc_verified: boolean;
  sc_claimed: boolean;
  sc_plan: string;
  sc_claim_expires_at: string;
}

export interface WPListingGalleryImage {
  id: number;
  url: string;
  alt: string;
}

export interface WPListing {
  id: number;
  slug: string;
  link: string;
  /** When this listing was created — WP's own real post date, not synthesized. Shown as "Listed since" on the listing page. */
  date: string;
  title: WPRendered;
  content: WPRendered;
  author: number;
  sc_listing_category: number[];
  meta: WPListingMeta;
  /** True once a claim has been requested but not yet approved — see SC_Directory_REST::claim_listing. */
  sc_claim_pending?: boolean;
  /** Resolved from the sc_gallery attachment-ID meta server-side — see SC_Directory_REST's sc_gallery_images REST field. */
  sc_gallery_images?: WPListingGalleryImage[];
  /** Rolled up from approved review comments (sc_rating meta) server-side — see SC_Directory_REST's sc_review_stats REST field. Powers the Most Reviews / Highest Rated directory sort. */
  sc_review_stats?: { count: number; average: number | null };
  _embedded?: {
    "wp:featuredmedia"?: WPFeaturedMedia[];
  };
}

const DIRECTORY_LISTING_FIELDS =
  "id,slug,link,date,title,content,author,sc_listing_category,meta,sc_gallery_images,sc_claim_pending,sc_review_stats,_links";

/**
 * Staging (see WP_STAGING_ROOT) turned out to be far less reliably
 * reachable from Vercel's runtime than the live site is — confirmed live:
 * /directory hung for 60+ seconds and got killed by Vercel's own function
 * timeout, because this inherited wpFetch's default 9-attempt retry chain.
 * 3 attempts (matching what getAd() already used defensively) plus a hard
 * per-request timeout keeps a bad day on staging from ever hanging a page.
 */
async function scDirectoryFetch<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(
    `${WP_STAGING_ROOT}/wp/v2${path}`,
    { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(15_000) },
    3
  );
  if (!res.ok) {
    throw new Error(`sc-directory fetch failed: ${path} -> ${res.status}`);
  }
  return res.json();
}

export function getDirectoryListings(perPage = 100) {
  return scDirectoryFetch<WPListing[]>(
    `/sc-listings?per_page=${perPage}&_fields=${DIRECTORY_LISTING_FIELDS}&_embed=wp:featuredmedia`
  );
}

export async function getDirectoryListingBySlug(slug: string): Promise<WPListing | null> {
  const listings = await scDirectoryFetch<WPListing[]>(
    `/sc-listings?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`
  );
  return listings[0] ?? null;
}

export function getDirectoryListingsByCategory(categoryId: number, perPage = 100) {
  return scDirectoryFetch<WPListing[]>(
    `/sc-listings?sc_listing_category=${categoryId}&per_page=${perPage}&_fields=${DIRECTORY_LISTING_FIELDS}&_embed=wp:featuredmedia`
  );
}

export interface WPDirectoryCategory {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export function getDirectoryCategories() {
  return scDirectoryFetch<WPDirectoryCategory[]>(`/sc_listing_category?per_page=50`);
}

/** For a member's public profile page — "listings they've submitted." WP's core REST author param needs no custom route. */
export function getDirectoryListingsByAuthor(authorId: number) {
  return scDirectoryFetch<WPListing[]>(
    `/sc-listings?author=${authorId}&per_page=50&_fields=id,slug,link,date,title,content,author,sc_listing_category,meta,sc_gallery_images,sc_claim_pending,_links&_embed=wp:featuredmedia`
  );
}

/**
 * Same reasoning as updateEvent — Subscriber has no edit_posts capability
 * at all, so WordPress's own wp/v2/sc-listings/{id} route would 403 an
 * owner editing their own listing even though they're the author. This
 * custom /sc-directory/v1/{id} route checks ownership manually instead
 * (SC_Directory_REST::check_owns_listing) and also allows any
 * admin/editor through, same as the event equivalent.
 */
export async function updateDirectoryListing(
  token: string,
  listingId: number,
  data: Record<string, string | string[]>
): Promise<{ id: number; status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/${listingId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "update_failed", message: body.message ?? "Could not update the listing." };
    }
    return { id: body.id, status: body.status };
  } catch {
    return NETWORK_ERROR;
  }
}

/** Adding photos to a listing's gallery — multipart, so the FormData (built client-side from <input type="file">) is forwarded as-is rather than JSON-encoded. */
export async function uploadListingPhotos(
  token: string,
  listingId: number,
  formData: FormData
): Promise<{ gallery: number[] } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/${listingId}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "upload_failed", message: body.message ?? "Could not upload photo(s)." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

export async function deleteListingPhoto(
  token: string,
  listingId: number,
  attachmentId: number
): Promise<{ gallery: number[] } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/${listingId}/photos/delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ attachment_id: attachmentId }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "delete_failed", message: body.message ?? "Could not remove photo." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

/** Owner-initiated renewal — extends (or reinstates, if it already lapsed) a claim's expiry by a year. See SC_Directory_REST::renew_claim. */
export async function renewListingClaim(
  token: string,
  listingId: number
): Promise<{ status: string; expires_at: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/${listingId}/renew-claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "renew_failed", message: body.message ?? "Could not renew the claim." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

// ---------------------------------------------------------------------------
// sc-events — real REST date/venue fields, no HTML-scraping needed. The
// ~257 real events have been migrated from EventON's live data (see
// scrape_events.py/import_events.py in the migration scratch directory —
// one-off scripts, not part of this repo) into sc-events on staging; the
// Events pages below read from here now instead of getEvents/getEventSchema.
// ---------------------------------------------------------------------------

export interface WPScEventMeta {
  sc_start: string;
  sc_end: string;
  sc_venue_name: string;
  sc_venue_address: string;
  sc_organizer: string;
  sc_event_url: string;
  /** The "Coming up next" hero slot's paid-upgrade flag — admin-set only, see SC_Events_Meta. */
  sc_event_featured: boolean;
}

export interface WPScEvent {
  id: number;
  slug: string;
  link: string;
  date: string;
  author: number;
  title: WPRendered;
  content: WPRendered;
  meta: WPScEventMeta;
  sc_event_category: number[];
  sc_event_tag: number[];
  sc_event_rsvp_count?: number;
  sc_event_author_is_staff?: boolean;
  sc_event_company?: { id: number; name: string; slug: string } | null;
  sc_event_listing_id?: number;
  _embedded?: {
    "wp:featuredmedia"?: WPFeaturedMedia[];
    author?: WPPublicUser[];
  };
}

/** No `link` field — WP core's own /wp/v2/users response had one, but nothing here reads it and the replacement endpoint below doesn't bother computing it. */
export interface WPPublicUser {
  id: number;
  name: string;
  slug: string;
  description: string;
  avatar_urls?: Record<string, string>;
  banned?: boolean;
  points?: number;
  tier?: { slug: string; label: string };
  recent_activity?: Array<{ points: number; reason: string; date: string }>;
}

/**
 * Deliberately not WP core's /wp/v2/users?slug= — that endpoint silently
 * hides any account that hasn't authored public content (a WP core
 * privacy default), which 404'd the public profile page for almost
 * every member on this site. SC_Membership_REST::get_member_by_slug has
 * no such restriction, same as getAllMembers already needed for the
 * full /members list.
 */
export async function getWPUserBySlug(slug: string): Promise<WPPublicUser | null> {
  try {
    // no-store, same reasoning as getAllMembers: points/activity change as
    // members do things, and an hour-stale profile is how a genuinely
    // active member ends up looking "blank" right after they've engaged.
    const res = await fetchWithRetry(
      `${WP_STAGING_ROOT}/sc-membership/v1/members/${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
      3
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Admin-only — bans (or unbans) a member, blocking their login. See SC_Membership_REST::moderate_member. */
export async function moderateMember(
  token: string,
  userId: number,
  action: "ban" | "unban"
): Promise<{ status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/members/${userId}/moderate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "moderate_failed", message: body.message ?? "Could not update this member." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

export interface WPMember {
  id: number;
  display_name: string;
  slug: string;
  avatar: string;
  points: number;
}

/**
 * Every registered member — deliberately not getWPUserBySlug's /users
 * endpoint looped over IDs: WP core's REST users list only surfaces
 * accounts that have authored public content, which would silently drop
 * anyone who's registered but hasn't posted an event/listing/comment yet.
 * SC_Membership_REST::get_members() has no such restriction.
 */
export async function getAllMembers(): Promise<WPMember[]> {
  // no-store, not the usual REVALIDATE_SECONDS cache: points/activity change
  // as members do things around the site, and an hour-stale "Most active"
  // ranking reads as broken (looks identical to a plain alphabetical list
  // once nearly everyone's cached points are 0) rather than just delayed.
  const res = await fetchWithRetry(
    `${WP_STAGING_ROOT}/sc-membership/v1/members`,
    { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    3
  );
  if (!res.ok) {
    throw new Error(`sc-membership members fetch failed -> ${res.status}`);
  }
  return res.json();
}

/** Slug/venue-name matching, not a real venue entity — see getScEventsByVenue's docblock. */
export function slugifyVenue(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface WPScEventCategory {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export function getScEventCategories() {
  return scDirectoryFetch<WPScEventCategory[]>(`/sc_event_category?per_page=50`);
}

/** Subject tags (Comedy, Music, Festival, ...) — EventON's event_type, migrated onto sc_event_tag. */
export interface WPScEventTag {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export function getScEventTags() {
  return scDirectoryFetch<WPScEventTag[]>(`/sc_event_tag?per_page=50`);
}

export interface WPEventVenue {
  name: string;
  address: string;
}

/** Every venue already in use, for the add/edit event form's picker — see SC_Events_REST::get_venues. */
export async function getEventVenues(): Promise<WPEventVenue[]> {
  const res = await fetchWithRetry(
    `${WP_STAGING_ROOT}/sc-events/v1/venues`,
    { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(15_000) },
    3
  );
  if (!res.ok) {
    throw new Error(`sc-events venues fetch failed -> ${res.status}`);
  }
  return res.json();
}

/**
 * `orderby=meta_value&meta_key=sc_start` looks like the obvious way to get
 * events in date order from WP's REST API, but this CPT never registered
 * the custom REST query-var support meta-value sorting needs — sending
 * those params doesn't 400, it just silently breaks the query (confirmed:
 * it returns 3 posts out of 257, not an error). Sorted here in JS instead,
 * using the same date parser the rest of this file already relies on —
 * correct regardless of what WP's REST layer does or doesn't support.
 *
 * WP's REST controller also caps per_page at 100, so perPage above that
 * paginates internally rather than 400ing.
 */
export async function getScEvents(perPage = 100): Promise<WPScEvent[]> {
  const events: WPScEvent[] = [];
  let page = 1;
  while (events.length < perPage) {
    const batchSize = Math.min(100, perPage - events.length);
    const batch = await scDirectoryFetch<WPScEvent[]>(
      `/sc-events?per_page=${batchSize}&page=${page}&_fields=id,slug,link,date,author,title,content,meta,sc_event_category,sc_event_tag,sc_event_rsvp_count,sc_event_author_is_staff,sc_event_company,_links&_embed=author,wp:featuredmedia`
    );
    events.push(...batch);
    if (batch.length < batchSize) break;
    page++;
  }
  return events.sort((a, b) => {
    const aDate = parseEventDate(a.meta.sc_start);
    const bDate = parseEventDate(b.meta.sc_start);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.getTime() - bDate.getTime();
  });
}

export async function getScEventBySlug(slug: string): Promise<WPScEvent | null> {
  const events = await scDirectoryFetch<WPScEvent[]>(
    `/sc-events?slug=${encodeURIComponent(slug)}&_embed=author,wp:featuredmedia`
  );
  return events[0] ?? null;
}

/**
 * "All events at this venue" — sc_venue_name is free text, not a real
 * venue entity/taxonomy, so this matches on the slugified name rather
 * than an ID. Good enough for now; a proper venues taxonomy (with its
 * own address/map once, not repeated per event) is future work if venue
 * pages turn out to want more than a list.
 */
function isUpcoming(event: WPScEvent, now = Date.now()): boolean {
  const start = parseEventDate(event.meta.sc_start);
  return start !== null && start.getTime() >= now;
}

/** "All upcoming events at this venue" — past events at the same venue aren't useful to surface here. */
export async function getScEventsByVenue(venueSlug: string): Promise<WPScEvent[]> {
  const events = await getScEvents(300);
  return events.filter(
    (e) => e.meta.sc_venue_name && slugifyVenue(e.meta.sc_venue_name) === venueSlug && isUpcoming(e)
  );
}

/**
 * Every event by this member, past and upcoming both — unlike
 * getScEventsByVenue, this feeds the member profile page's engagement
 * history (Rob wants to see what someone's actually submitted over time,
 * not just what's still to come), so it deliberately doesn't apply
 * isUpcoming's filter. Callers that want "what's next" should filter the
 * result themselves.
 */
export async function getScEventsByAuthor(authorId: number): Promise<WPScEvent[]> {
  const events = await getScEvents(300);
  return events.filter((e) => e.author === authorId);
}

/**
 * Owner-only edit, via the custom sc-events/v1/{id} route rather than WP's
 * own wp/v2/sc-events/{id} — members are Subscribers with no edit_posts
 * capability at all, so the generic REST controller would 401/403 for
 * every member regardless of whose post it is. Every field is optional:
 * only keys present in `data` get touched server-side (see
 * SC_Events_REST::update_event's docblock).
 */
export async function updateEvent(
  token: string,
  eventId: number,
  data: Record<string, string | string[]>
): Promise<{ id: number; status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/${eventId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "update_failed", message: body.message ?? "Could not update the event." };
    }
    return { id: body.id, status: body.status };
  } catch {
    return NETWORK_ERROR;
  }
}

/** Reassigns a staff/import-authored event to the claiming member — see SC_Events_REST::claim_event's docblock. */
export async function claimEvent(token: string, eventId: number): Promise<{ status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/${eventId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "claim_failed", message: body.message ?? "Could not claim this event." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

export interface RsvpStatus {
  going: boolean;
  going_count: number;
}

export async function getEventRsvpStatus(token: string, eventId: number): Promise<RsvpStatus | null> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/${eventId}/rsvp`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function rsvpToEvent(token: string, eventId: number): Promise<RsvpStatus | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/${eventId}/rsvp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "rsvp_failed", message: body.message ?? "Could not RSVP to this event." };
    }
    return { going: true, going_count: body.going_count };
  } catch {
    return NETWORK_ERROR;
  }
}

export async function unRsvpFromEvent(token: string, eventId: number): Promise<RsvpStatus | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/${eventId}/rsvp`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "rsvp_failed", message: body.message ?? "Could not update your RSVP." };
    }
    return { going: false, going_count: body.going_count };
  } catch {
    return NETWORK_ERROR;
  }
}

export async function getRecentScEventSlugs(count: number): Promise<string[]> {
  const events = await getScEvents(300);
  return events.slice(0, count).map((e) => e.slug);
}

/**
 * getScEvents already returns every event sorted ascending by sc_start
 * (past first, undated last) — "upcoming only" just drops anything before
 * now and takes the first `count`.
 */
export async function getUpcomingScEvents(count: number): Promise<WPScEvent[]> {
  const events = await getScEvents(300);
  return events.filter((e) => isUpcoming(e)).slice(0, count);
}

/** Most recently *added* to the site — WP's own post `date`, not sc_start. */
export async function getLatestAddedScEvents(count: number): Promise<WPScEvent[]> {
  const events = await getScEvents(300);
  return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, count);
}

// ---------------------------------------------------------------------------
// sc-jobs — Jobs Board (staging only, see WP_STAGING_ROOT note). Phase 1:
// API-sourced (Reed) listings only, no member submission yet — see the
// sc-jobs plugin's own docblock.
// ---------------------------------------------------------------------------

export interface WPJobMeta {
  source: "api" | "member";
  featured: boolean;
  expiry_date: string;
  external_url: string;
  job_company: string;
  job_salary_text: string;
}

export interface WPJobListing {
  id: number;
  slug: string;
  link: string;
  date: string;
  title: WPRendered;
  content: WPRendered;
  meta: WPJobMeta;
  job_sector: number[];
  job_location: number[];
}

export interface WPJobTerm {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export function getJobListings(perPage = 100) {
  return scDirectoryFetch<WPJobListing[]>(
    `/job-listings?per_page=${perPage}&orderby=date&order=desc&_fields=id,slug,link,date,title,content,meta,job_sector,job_location`
  );
}

export function getJobLocations() {
  return scDirectoryFetch<WPJobTerm[]>(`/job_location?per_page=50`);
}

export function getJobSectors() {
  return scDirectoryFetch<WPJobTerm[]>(`/job_sector?per_page=50`);
}

export async function getJobListingBySlug(slug: string): Promise<WPJobListing | null> {
  const jobs = await scDirectoryFetch<WPJobListing[]>(
    `/job-listings?slug=${encodeURIComponent(slug)}`
  );
  return jobs[0] ?? null;
}

// ---------------------------------------------------------------------------
// sc-membership — auth bridge + member dashboard data (staging only)
// ---------------------------------------------------------------------------

export interface MemberAuthResponse {
  token: string;
  user: { id: number; display_name: string; email: string };
  expires_in: number;
}

export interface MemberAuthError {
  code: string;
  message: string;
}

const NETWORK_ERROR: MemberAuthError = {
  code: "network_error",
  message: "Couldn't reach the membership service — please try again in a moment.",
};

export async function loginMember(
  username: string,
  password: string
): Promise<MemberAuthResponse | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export async function registerMember(
  username: string,
  email: string,
  password: string
): Promise<MemberAuthResponse | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export interface MemberProfile {
  id: number;
  display_name: string;
  is_returning: boolean;
  is_editor: boolean;
  email_verified: boolean;
  points: number;
  tier: { slug: string; label: string };
  points_to_next_tier: number | null;
  next_tier: { slug: string; label: string } | null;
  directory_upgrade_status: string | null;
  directory_upgrade_listing_id: number | null;
  joined_at: string;
  recent_activity: Array<{ points: number; reason: string; source: string; date: string }>;
}

/**
 * The dashboard page treats a null return as "not logged in" and redirects
 * to /login — that must never be blocked behind a hung request, so any
 * network failure here (staging being unreachable, timeout, etc.) resolves
 * to null rather than throwing and hanging the page render.
 */
export async function getMemberMe(token: string): Promise<MemberProfile | null> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function requestDirectoryUpgrade(
  token: string,
  listingId?: number
): Promise<{ status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/directory-upgrade-request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(listingId ? { listing_id: listingId } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export async function verifyEmail(token: string): Promise<{ status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export async function claimListing(
  token: string,
  listingId: number
): Promise<{ status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/${listingId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "claim_failed", message: body.message ?? "Could not claim this listing." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

/** sessionToken here is the bearer token identifying the logged-in member, not the verify link's token. */
export async function resendVerification(
  sessionToken: string
): Promise<{ status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

// ---------------------------------------------------------------------------
// sc-directory / sc-events submissions — members submitting a new listing or
// event, always landing as 'pending' for Rob to review (see the plugins'
// own submit_listing/submit_event docblocks for why).
// ---------------------------------------------------------------------------

export async function submitListing(
  token: string,
  data: Record<string, string | string[]>
): Promise<{ status: string; id: number } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export async function submitEvent(
  token: string,
  data: Record<string, string | string[]>
): Promise<{ status: string; id: number } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export interface SubmittedComment {
  id: number;
  status: "approved" | "unapproved" | "spam" | "trash";
  author_name: string;
  date: string;
  content: WPRendered;
  rating: number | null;
}

export interface EditedComment {
  id: number;
  status: "approved" | "unapproved" | "spam" | "trash";
  date: string;
  content: WPRendered;
  rating: number | null;
}

export interface MyListing {
  id: number;
  title: string;
  status: string;
  slug: string;
  date: string;
}

export async function getMyListings(token: string): Promise<MyListing[]> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-directory/v1/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface MyEvent {
  id: number;
  title: string;
  status: string;
  slug: string;
  start: string;
  views: number;
}

/**
 * View counts aren't part of sc-events' own /mine response — they come
 * from the separate sc-post-views store (see getPostViewCount), keyed by
 * the same numeric post id regardless of post type. Fetched here rather
 * than pushed into sc-events' PHP so that plugin stays unaware of
 * sc-post-views entirely, same loose coupling sc-post-views' own docblock
 * describes from the other side.
 */
export async function getMyEvents(token: string): Promise<MyEvent[]> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-events/v1/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const events: Array<Omit<MyEvent, "views">> = await res.json();
    return Promise.all(
      events.map(async (event) => ({ ...event, views: await getPostViewCount(event.id) }))
    );
  } catch {
    return [];
  }
}

export interface MyComment {
  id: number;
  content: WPRendered;
  date: string;
  status: string;
  post_type: string | null;
  post_slug: string | null;
  post_title: string | null;
}

export async function getMyComments(token: string): Promise<MyComment[]> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/my-comments`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Publishes an AI-drafted (and editor-reviewed) article as a WordPress
 * 'pending' post — never straight to 'publish' (brief section 14: draft
 * → human approval → publish, nothing goes public automatically). Goes
 * to staging's native wp/v2/posts, not a custom sc-* route: the member's
 * bearer token already satisfies is_user_logged_in() there the same way
 * it does for every other sc-membership-backed call, and WP core's own
 * post capability check (edit_posts) does the real enforcement — the
 * frontend's is_editor gate is a UI convenience, not the security
 * boundary. Categories/tags aren't resolved to term IDs here (staging's
 * taxonomy may not match live's) — the editor applies them by hand in
 * wp-admin after this lands as a pending post, same as reviewing any
 * other field before publishing.
 */
export async function createDraftPost(
  token: string,
  data: { title: string; content: string; excerpt: string }
): Promise<{ id: number; status: string } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/wp/v2/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, status: "pending" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "publish_failed", message: body.message ?? "Could not create the draft post." };
    }
    return { id: body.id, status: body.status };
  } catch {
    return NETWORK_ERROR;
  }
}

export async function submitComment(
  token: string,
  postId: number,
  content: string,
  parent?: number,
  rating?: number
): Promise<SubmittedComment | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, content, parent: parent ?? 0, rating }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

/** Editing puts the comment/review back into moderation — see SC_Membership_REST::update_comment's own docblock for why. Only the owner, within a week of posting; the REST route enforces both, this is just the transport. */
export async function editComment(
  token: string,
  commentId: number,
  content: string,
  rating?: number
): Promise<EditedComment | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/comments/${commentId}/edit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content, rating }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export interface BookmarkState {
  count: number;
  bookmarked: boolean;
  logged_in: boolean;
}

/** Public — no token needed. Used to render the count/state on first paint for any viewer, logged in or not. */
export async function getBookmarkState(
  contentType: "post" | "listing",
  contentId: number,
  token?: string
): Promise<BookmarkState | MemberAuthError> {
  try {
    const res = await fetch(
      `${WP_STAGING_ROOT}/sc-membership/v1/bookmarks/state?content_type=${contentType}&content_id=${contentId}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );
    return res.json();
  } catch {
    return NETWORK_ERROR;
  }
}

export async function toggleBookmark(
  token: string,
  contentType: "post" | "listing",
  contentId: number
): Promise<{ bookmarked: boolean; count: number } | MemberAuthError> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/bookmarks/toggle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: contentType, content_id: contentId }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { code: body.code ?? "bookmark_failed", message: body.message ?? "Could not update bookmark." };
    }
    return body;
  } catch {
    return NETWORK_ERROR;
  }
}

// ---------------------------------------------------------------------------
// Site search — mirrors the live site's /search-page/ filter form exactly
// (category tabs, title/content search mode, theme tag, sort), extended to
// also cover events and directory listings, which the original only ever
// searched posts for.
// ---------------------------------------------------------------------------

export interface SiteSearchFilters {
  q: string;
  category: string; // "" (All) | "news" | "stories" | "walks" | "events" | "directory"
  searchMode: string; // "both" | "title" | "content" — posts only, matching the live filter
  tag: string; // theme tag slug — posts only
  sort: string; // "" | "newest" | "oldest" | "az" | "za"
}

export interface SearchResultItem {
  type: "post" | "event" | "listing";
  id: number;
  title: string;
  excerpt: string;
  href: string;
  date: string;
  image: WPFeaturedMedia | null;
  meta?: string;
}

/**
 * The live site's "News"/"Stories"/"Walks" category filter passes a `cat`
 * query var straight through to WP_Query, whose classic `cat` param
 * includes descendant categories by default (unlike REST's `categories`
 * param, which is an exact-term match only) — so "Stories" there also
 * catches posts filed under a story-area subcategory. Reproducing that
 * needs the subcategory IDs gathered explicitly, the same way
 * storyAreas/walkDistances already do in layout.tsx.
 */
async function categoryIdsWithChildren(slug: string): Promise<number[]> {
  const [category, allCategories] = await Promise.all([getCategoryBySlug(slug), getCategories()]);
  if (!category) return [];
  const childIds = allCategories.filter((c) => c.parent === category.id).map((c) => c.id);
  return [category.id, ...childIds];
}

/** search_mode has no REST equivalent — WP's own `search` param always matches title+content+excerpt — so it's applied as a filter on top of the real search results. */
function matchesSearchMode(title: string, content: string, q: string, mode: string): boolean {
  if (mode !== "title" && mode !== "content") return true;
  const needle = q.toLowerCase();
  return mode === "title"
    ? stripHtml(title).toLowerCase().includes(needle)
    : stripHtml(content).toLowerCase().includes(needle);
}

async function searchPostsFiltered(filters: SiteSearchFilters): Promise<SearchResultItem[]> {
  const { q, category, tag, sort } = filters;
  const params = new URLSearchParams();
  params.set("search", q);
  params.set("per_page", "60");
  params.set("_fields", "id,slug,date,link,title,excerpt,content,featured_media,_links");
  params.set("_embed", "wp:featuredmedia");
  if (sort === "az") {
    params.set("orderby", "title");
    params.set("order", "asc");
  } else if (sort === "za") {
    params.set("orderby", "title");
    params.set("order", "desc");
  } else if (sort === "oldest") {
    params.set("orderby", "date");
    params.set("order", "asc");
  } else {
    params.set("orderby", "date");
    params.set("order", "desc");
  }

  const isPostCategory = category === "news" || category === "stories" || category === "walks";
  const [categoryIds, tagObj] = await Promise.all([
    isPostCategory ? categoryIdsWithChildren(category) : Promise.resolve([]),
    tag ? getTagBySlug(tag) : Promise.resolve(null),
  ]);
  if (categoryIds.length) params.set("categories", categoryIds.join(","));
  if (tagObj) params.set("tags", String(tagObj.id));

  const posts = await wpFetch<WPContentItem[]>(`/posts?${params.toString()}`);
  return posts
    .filter((p) => matchesSearchMode(p.title.rendered, p.content.rendered, q, filters.searchMode))
    .map((p) => ({
      type: "post" as const,
      id: p.id,
      title: stripHtml(p.title.rendered),
      excerpt: stripHtml(p.excerpt.rendered),
      href: `/${p.slug}`,
      date: p.date,
      image: getFeaturedImage(p),
    }));
}

async function searchEventsFiltered(filters: SiteSearchFilters): Promise<SearchResultItem[]> {
  const events = await scDirectoryFetch<WPScEvent[]>(
    `/sc-events?search=${encodeURIComponent(filters.q)}&per_page=60&_fields=id,slug,link,date,title,content,meta,_links&_embed=wp:featuredmedia`
  );
  return events.map((e) => ({
    type: "event" as const,
    id: e.id,
    title: stripHtml(e.title.rendered),
    excerpt: stripHtml(e.content.rendered).slice(0, 160),
    href: `/events/${e.slug}`,
    date: e.meta.sc_start || e.date,
    image: getFeaturedImage(e),
    meta: e.meta.sc_venue_name || undefined,
  }));
}

async function searchDirectoryFiltered(filters: SiteSearchFilters): Promise<SearchResultItem[]> {
  const listings = await scDirectoryFetch<Array<WPListing & { date: string }>>(
    `/sc-listings?search=${encodeURIComponent(filters.q)}&per_page=60&_fields=id,slug,link,title,content,date,meta,_links&_embed=wp:featuredmedia`
  );
  return listings.map((l) => ({
    type: "listing" as const,
    id: l.id,
    title: stripHtml(l.title.rendered),
    excerpt: stripHtml(l.content.rendered).slice(0, 160),
    href: `/directory/${l.slug}`,
    date: l.date,
    image: getFeaturedImage(l),
    meta: l.meta.sc_address_town || undefined,
  }));
}

function sortResults(items: SearchResultItem[], sort: string): SearchResultItem[] {
  const sorted = [...items];
  if (sort === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "za") sorted.sort((a, b) => b.title.localeCompare(a.title));
  else if (sort === "oldest") sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  else sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sorted;
}

export async function searchSite(filters: SiteSearchFilters): Promise<SearchResultItem[]> {
  const q = filters.q.trim();
  if (!q) return [];
  const normalized = { ...filters, q };

  const wantsPosts = !filters.category || ["news", "stories", "walks"].includes(filters.category);
  const wantsEvents = !filters.category || filters.category === "events";
  const wantsDirectory = !filters.category || filters.category === "directory";

  const [posts, events, directory] = await Promise.all([
    wantsPosts ? searchPostsFiltered(normalized).catch(() => []) : Promise.resolve([]),
    wantsEvents ? searchEventsFiltered(normalized).catch(() => []) : Promise.resolve([]),
    wantsDirectory ? searchDirectoryFiltered(normalized).catch(() => []) : Promise.resolve([]),
  ]);

  return sortResults([...posts, ...events, ...directory], filters.sort);
}
