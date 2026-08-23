import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/app/_components/AdSlot";
import { CommentCountLink } from "@/app/_components/CommentCountLink";
import { CommentSection } from "@/app/_components/CommentSection";
import { getSessionToken } from "@/lib/auth";
import {
  getAllPageSlugs,
  getCategories,
  getCommentsForPost,
  getFeaturedImage,
  getMembersByIds,
  getMostReadPosts,
  getPageBySlug,
  getPostBySlug,
  getPosts,
  getRecentPostSlugs,
  getTags,
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

  const title = stripHtml(item.title.rendered);
  const description = stripHtml(item.excerpt.rendered) || undefined;
  const image = getFeaturedImage(item);

  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title,
      description,
      images: image ? [image.source_url] : undefined,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image.source_url] : undefined,
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
    return (
      <article className="container">
        <h1 dangerouslySetInnerHTML={{ __html: item.title.rendered }} />
        <time dateTime={item.date}>{formatDate(item.date)}</time>
        {image && <img src={image.source_url} alt={image.alt_text} />}
        <div dangerouslySetInnerHTML={{ __html: item.content.rendered }} />
      </article>
    );
  }

  const [allCategories, allTags, comments, fullThread, recentPosts, sessionToken] = await Promise.all([
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getCommentsForPost(post.id, 3).catch(() => []),
    getCommentsForPost(post.id, 50).catch(() => []),
    getPosts(15).catch(() => []),
    getSessionToken(),
  ]);

  const commenterProfileMap = await getMembersByIds(fullThread.map((c) => c.author ?? 0)).catch(
    () => new Map<number, { slug: string; name: string; avatar: string }>()
  );

  // Mirrors the live site's real in-article ad positions (groups 5 and 7
  // sampled mid-article and near the end) — only inserted when the post
  // actually has enough content for the slot to land naturally rather
  // than right after the opening paragraph.
  const contentChunks = splitContentIntoParagraphChunks(post.content.rendered);
  const inPost1After = contentChunks.length > 4 ? 3 : null;
  const inPost2After = contentChunks.length > 9 ? contentChunks.length - 3 : null;

  const mostRead = await getMostReadPosts(
    recentPosts.filter((p) => p.id !== post.id),
    5
  );

  const category = allCategories.find((c) => post.categories?.includes(c.id));
  const tag = allTags.find((t) => post.tags?.includes(t.id));

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: stripHtml(post.title.rendered),
    image: image ? [image.source_url] : undefined,
    datePublished: post.date,
    mainEntityOfPage: `${SITE_URL}/${post.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Secret Carshalton",
    },
  };

  return (
    <article>
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
                {category && <span className="post-category">{category.name}</span>}
                {tag && <span className="post-tag">{tag.name}</span>}
              </div>
              <h1 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="container">
          <div className="post-hero-meta">
            {category && <span className="post-category">{category.name}</span>}
            {tag && <span className="post-tag">{tag.name}</span>}
          </div>
          <h1 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
        </div>
      )}

      <div className="container post-layout">
        <div className="post-body">
          <div className="post-meta-row">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <CommentCountLink count={fullThread.length} />
          </div>
          <div className="post-content">
            {contentChunks.map((chunk, i) => (
              <Fragment key={i}>
                <div dangerouslySetInnerHTML={{ __html: chunk }} />
                {i === inPost1After && <AdSlot placement="in_post_1" className="ad-slot ad-in-post" />}
                {i === inPost2After && <AdSlot placement="in_post_2" className="ad-slot ad-in-post" />}
              </Fragment>
            ))}
          </div>

          <CommentSection
            postId={post.id}
            comments={fullThread}
            isLoggedIn={Boolean(sessionToken)}
            commenterProfiles={commenterProfileMap}
          />
        </div>

        <aside className="post-sidebar">
          {mostRead.length > 0 && (
            <div className="sidebar-block">
              <h3>Top posts</h3>
              <ol className="most-read-list">
                {mostRead.map((p) => (
                  <li key={p.id}>
                    <Link href={`/${p.slug}`} dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
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

          <AdSlot
            placement="sidebar"
            className="sidebar-block-ad"
            placeholderClassName="sidebar-ad-placeholder"
            placeholderText="Advertise here"
          />

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
