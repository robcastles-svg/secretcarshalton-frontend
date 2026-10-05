import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AboutMiniNav, ABOUT_PAGE_SLUGS } from "@/app/_components/AboutMiniNav";
import { SetActiveNavSection } from "@/app/_components/ActiveNavSection";
import { AdSlot } from "@/app/_components/AdSlot";
import { CommentCountLink } from "@/app/_components/CommentCountLink";
import { CommentSectionAsync } from "@/app/_components/CommentSectionAsync";
import { ContentList } from "@/app/_components/ContentList";
import { PostViewTracker } from "@/app/_components/PostViewTracker";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { YopPollScripts } from "@/app/_components/YopPollScripts";
import {
  categoryHref,
  getAd,
  getAllPageSlugs,
  getCategories,
  getCommentsForPost,
  getFeaturedImage,
  getMembersByIds,
  getPageBySlug,
  getPostBySlug,
  getPostsByCategory,
  getPostViewCount,
  getRecentPostSlugs,
  getTags,
  getTopPostsToday,
  navSectionForCategories,
  splitContentIntoParagraphChunks,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.secretcarshalton.com";

/**
 * Pre-rendering all ~650 posts/pages here fired that many requests at
 * secretcarshalton.com's shared-hosting REST API in a couple of minutes,
 * which is what was crashing builds. Pages (structural, ~75 of them,
 * cheap) still pre-render fully; posts are capped to the most recent 30
 * — the ones actually linked from the homepage/nav. Everything else
 * renders on first visit and is cached via ISR (the revalidate above),
 * so a deploy touches WordPress ~100 times instead of ~650.
 */
export async function generateStaticParams() {
  // A genuine (not just slow) WordPress failure here used to be able to
  // crash the whole build's static-params collection for this route —
  // meaning zero pages/posts pre-render for the entire deploy, not just
  // one. Empty arrays degrade to ISR-on-first-visit instead (see the
  // comment below), which is recoverable; a dead build isn't.
  const [pageSlugs, recentPostSlugs] = await Promise.all([
    getAllPageSlugs().catch(() => []),
    getRecentPostSlugs(30).catch(() => []),
  ]);
  const slugs = new Set([...pageSlugs, ...recentPostSlugs]);
  return Array.from(slugs).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = (await getPostBySlug(slug).catch(() => null)) ?? (await getPageBySlug(slug).catch(() => null));
  if (!item) return {};

  // Yoast's own title/description/social-image overrides, when an editor
  // has set them, win over the raw post fields — this is exactly the data
  // that's tuned for Google/social and was otherwise being silently
  // dropped by generating metadata from scratch instead of reading it.
  const yoast = item.yoast_head_json;
  const image = getFeaturedImage(item);
  const socialImage = yoast?.og_image?.[0]?.url || image?.source_url;

  const title = yoast?.title || stripHtml(item.title.rendered);
  const description = yoast?.description || stripHtml(item.excerpt.rendered) || undefined;
  const ogTitle = yoast?.og_title || title;
  const ogDescription = yoast?.og_description || description;
  const twitterImage = yoast?.twitter_image || socialImage;

  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    robots:
      yoast?.robots?.index === "noindex"
        ? { index: false, follow: yoast.robots.follow !== "nofollow" }
        : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: socialImage ? [socialImage] : undefined,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: yoast?.twitter_title || ogTitle,
      description: yoast?.twitter_description || ogDescription,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** WP's date/modified are plain "YYYY-MM-DDTHH:MM:SS" (site-local, no offset) — comparing the date portion as a string avoids any timezone parsing at all. */
function sameCalendarDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  const item = post ?? (await getPageBySlug(slug).catch(() => null));

  if (!item) notFound();

  const image = getFeaturedImage(item);

  // Pages (About, Contact, Help, etc.) get the plain layout — no
  // category/tag, sidebar, or comments, since those are post concepts.
  if (!post) {
    const isAboutPage = ABOUT_PAGE_SLUGS.includes(slug);
    return (
      <>
        {isAboutPage && <AboutMiniNav activeSlug={slug} />}
        {slug === "polls" && (
          <>
            <link rel="stylesheet" href="/vendor/yop-poll.css" />
            <YopPollScripts />
          </>
        )}
        {/* The main image for two of the four About pages: Latest Comments
            and Polls both have a real WP featured image set (checked via
            the REST API). The other two (About Secret Carshalton, Welcome
            to Carshalton) don't — featured_media: 0 — their main image is
            the first one embedded in the page's own content instead,
            handled by .sow-image-container's CSS further down. */}
        {isAboutPage && image && <img src={image.source_url} alt={image.alt_text} className="about-page-image" />}
        <article className="container">
          {!isAboutPage && <h1 dangerouslySetInnerHTML={{ __html: item.title.rendered }} />}
          {!isAboutPage && <time dateTime={item.date}>{formatDate(item.date)}</time>}
          {!isAboutPage && image && <img src={image.source_url} alt={image.alt_text} />}
          <div
            className={
              isAboutPage
                ? // All four pages' embedded headings stay visible now, per
                  // Rob — except Welcome to Carshalton's first one, which is
                  // genuinely empty (a single &nbsp;, left over from the
                  // original page build) rather than a real heading to show.
                  `about-page-content${slug === "welcome-to-carshalton" ? " about-page-content-hide-empty-heading" : ""}`
                : undefined
            }
            dangerouslySetInnerHTML={{ __html: item.content.rendered }}
          />
        </article>
      </>
    );
  }

  const [allCategories, allTags, comments, fullThread, viewCount, topToday, sidebarAd1, sidebarAd2, sidebarAd3] =
    await Promise.all([
      getCategories().catch(() => []),
      getTags().catch(() => []),
      getCommentsForPost(post.id, 3).catch(() => []),
      getCommentsForPost(post.id, 50).catch(() => []),
      getPostViewCount(post.id),
      // +1: the current post is filtered out below, so ask for one extra
      // to still land on 5 when it would otherwise have been in the list.
      getTopPostsToday(6),
      // Up to 3 rotating blue ads in the sidebar. in_article ads aren't
      // included here: they render embedded in the article body instead
      // (see the two <AdSlot placement="in_article"> below), so a member
      // who paid for "in-article" isn't also shown in the sidebar for free.
      getAd("sidebar", 1),
      getAd("sidebar", 2),
      getAd("sidebar", 3),
    ]);

  // The viewer's own session (cookies()) isn't fetched here — see
  // CommentSectionAsync's docblock for why that has to be isolated behind
  // its own <Suspense> boundary rather than read directly in this page.
  const commenterProfileMap = await getMembersByIds(fullThread.map((c) => c.author ?? 0)).catch(
    () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string }>()
  );

  // Mirrors the live site's real in-article ad positions (groups 5 and 7
  // sampled mid-article and near the end) — only inserted when the post
  // actually has enough content for the slot to land naturally rather
  // than right after the opening paragraph. Each slot tries its own
  // admin-managed zone first (in_post_1/in_post_2 — sc-ads' original
  // AdRotate-mirroring zones, for ads Rob sells/sets up directly), falling
  // back to the simpler self-serve "in_article" pool when nothing's set
  // for that zone — so the two ad systems share these positions instead
  // of self-serve in-article ads having nowhere of their own to render.
  const contentChunks = splitContentIntoParagraphChunks(post.content.rendered);
  const inPost1After = contentChunks.length > 4 ? 3 : null;
  const inPost2After = contentChunks.length > 9 ? contentChunks.length - 3 : null;

  const topPostsToday = topToday.filter((p) => p.post_id !== post.id).slice(0, 5);

  const category = allCategories.find((c) => post.categories?.includes(c.id));
  const tag = allTags.find((t) => post.tags?.includes(t.id));
  const navSection = navSectionForCategories(post.categories, allCategories);
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));

  // Same category as this post, itself excluded — reuses getPostsByCategory
  // (already the shared fetch for news/walks/stories/people listings) so
  // "related" means genuinely the same section a reader browsing that
  // category would see, not a separate relevance algorithm.
  const relatedPosts = category
    ? (await getPostsByCategory(category.id).catch(() => []))
        .filter((p) => p.id !== post.id)
        .slice(0, 4)
    : [];

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: stripHtml(post.title.rendered),
    image: image ? [image.source_url] : undefined,
    datePublished: post.date,
    dateModified: post.modified || post.date,
    mainEntityOfPage: `${SITE_URL}/${post.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Secret Carshalton",
    },
  };

  return (
    <article>
      <SetActiveNavSection section={navSection} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {image ? (
        <div className="post-hero">
          <img src={image.source_url} alt={image.alt_text} />
          <div className="post-hero-overlay">
            <div className="container">
              <div className="post-hero-meta">
                {category && (
                  <Link href={categoryHref(category, categoriesById)} className="post-category">
                    {category.name}
                  </Link>
                )}
                {tag && (
                  <Link href={`/themes/${tag.slug}`} className="post-tag">
                    {tag.name}
                  </Link>
                )}
              </div>
              <h1 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="container">
          <div className="post-hero-meta">
            {category && (
              <Link href={categoryHref(category, categoriesById)} className="post-category">
                {category.name}
              </Link>
            )}
            {tag && (
              <Link href={`/themes/${tag.slug}`} className="post-tag">
                {tag.name}
              </Link>
            )}
          </div>
          <h1 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
        </div>
      )}

      <div className="container post-layout">
        <div className="post-body">
          <PostViewTracker postId={post.id} slug={post.slug} title={stripHtml(post.title.rendered)} />
          <div className="post-meta-row">
            <time dateTime={post.date}>Published: {formatDate(post.date)}</time>
            {post.modified && !sameCalendarDay(post.date, post.modified) && (
              <time dateTime={post.modified}>Updated: {formatDate(post.modified)}</time>
            )}
            <span className="post-view-count">
              <EyeIcon /> {viewCount.toLocaleString("en-GB")}
            </span>
            <CommentCountLink count={fullThread.length} />
          </div>
          <div className="post-content">
            {contentChunks.map((chunk, i) => (
              <Fragment key={i}>
                <div dangerouslySetInnerHTML={{ __html: chunk }} />
                {i === inPost1After && (
                  <AdSlot placement="in_post_1" fallbackPlacement="in_article" className="ad-slot ad-in-post" />
                )}
                {i === inPost2After && (
                  <AdSlot placement="in_post_2" fallbackPlacement="in_article" className="ad-slot ad-in-post" />
                )}
              </Fragment>
            ))}
          </div>

          <Suspense fallback={null}>
            <CommentSectionAsync postId={post.id} comments={fullThread} commenterProfiles={commenterProfileMap} />
          </Suspense>

          {relatedPosts.length > 0 && (
            <section className="related-stories">
              <h2>Related stories</h2>
              <ContentList
                items={relatedPosts}
                categoriesById={categoriesById}
                tagsById={tagsById}
                className="post-list-two-column"
              />
            </section>
          )}
        </div>

        <aside className="post-sidebar">
          {topPostsToday.length > 0 && (
            <div className="sidebar-block">
              <h3>Top 5 posts today</h3>
              <ol className="most-read-list">
                {topPostsToday.map((p) => (
                  <li key={p.post_id}>
                    <Link href={`/${p.slug}`}>{p.title}</Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {comments.length > 0 && (
            <div className="sidebar-block">
              <h3>Recent comments</h3>
              <ul className="sidebar-comment-list">
                {comments.map((c) => (
                  <li key={c.id}>
                    <strong>{c.author_name}</strong>
                    <p>{stripHtml(c.content.rendered)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} />

          {allTags.length > 0 && (
            <div className="sidebar-block">
              <h3>Stories by theme</h3>
              <ul className="sidebar-theme-list">
                {allTags
                  .filter((t) => t.count === undefined || t.count > 0)
                  .slice(0, 24)
                  .map((t) => (
                    <li key={t.id}>
                      <Link href={`/themes/${t.slug}`}>{t.name.toUpperCase()}</Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <Link href="/register" className="sidebar-ad">
            <strong>Become a member</strong>
            <span>Join Secret Carshalton — free and paid tiers available.</span>
          </Link>
        </aside>
      </div>
    </article>
  );
}
