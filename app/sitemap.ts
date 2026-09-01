import type { MetadataRoute } from "next";
import {
  getAllPageSlugs,
  getAllPostSlugs,
  getCategories,
  getDirectoryListings,
  getScEvents,
} from "@/lib/wordpress";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.secretcarshalton.com";

export const revalidate = 3600;

const FALLBACK_SITEMAP: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/directory`, changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.8 },
];

/**
 * A sitemap is a nice-to-have, never worth taking down a deploy over. Two
 * layers of protection, because one alone wasn't enough:
 *
 * - try/catch around a thrown error (a previous version had this alone —
 *   it stopped a *crash* from failing the build, but not what actually
 *   happened next: Next.js kills any route that takes over 60 seconds to
 *   generate, and the retry/backoff chains inside the WordPress fetches
 *   can still run past that even when they eventually succeed or resolve
 *   via their own internal .catch(() => []) fallbacks — the *time*, not
 *   just the outcome, is the problem).
 * - a hard wall-clock timeout via Promise.race, so this route always
 *   resolves in well under 60 seconds regardless of how slow WordPress is
 *   being, falling back to a minimal static sitemap if it can't finish.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await Promise.race([
      buildSitemap(),
      new Promise<MetadataRoute.Sitemap>((resolve) =>
        setTimeout(() => resolve(FALLBACK_SITEMAP), 20_000)
      ),
    ]);
  } catch {
    return FALLBACK_SITEMAP;
  }
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const [pageSlugs, posts, categories, events, listings] = await Promise.all([
    getAllPageSlugs().catch(() => []),
    getAllPostSlugs(),
    getCategories().catch(() => []),
    getScEvents(300).catch(() => []),
    getDirectoryListings().catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = [...FALLBACK_SITEMAP];

  for (const slug of pageSlugs) {
    entries.push({ url: `${SITE_URL}/${slug}`, changeFrequency: "monthly", priority: 0.5 });
  }

  for (const post of posts) {
    entries.push({
      url: `${SITE_URL}/${post.slug}`,
      lastModified: post.modified,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Only top-level categories with a dedicated route (news/stories/walks/people)
  // get a flat URL. Their children are nested (/stories/{area}, /walks/{distance}) —
  // a flat /{slug} for those would be wrong, since no such route exists.
  const TOP_LEVEL_ROUTES: Record<string, string> = {
    news: "/news",
    stories: "/stories",
    walks: "/walks",
    people: "/people",
  };
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  for (const category of categories) {
    if (category.parent === 0) {
      const route = TOP_LEVEL_ROUTES[category.slug];
      if (route) {
        entries.push({ url: `${SITE_URL}${route}`, changeFrequency: "daily", priority: 0.6 });
      }
      continue;
    }
    const parent = categoriesById.get(category.parent);
    const parentRoute = parent ? TOP_LEVEL_ROUTES[parent.slug] : null;
    if (parentRoute) {
      entries.push({
        url: `${SITE_URL}${parentRoute}/${category.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  for (const event of events) {
    entries.push({ url: `${SITE_URL}/events/${event.slug}`, changeFrequency: "weekly", priority: 0.5 });
  }

  for (const listing of listings) {
    entries.push({ url: `${SITE_URL}/directory/${listing.slug}`, changeFrequency: "monthly", priority: 0.5 });
  }

  return entries;
}
