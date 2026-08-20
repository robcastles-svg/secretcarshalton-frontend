import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllPageSlugs,
  getCategories,
  getCommentsForPost,
  getFeaturedImage,
  getMostReadPosts,
  getPageBySlug,
  getPostBySlug,
  getPosts,
  getRecentPostSlugs,
  getTags,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

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
  const [pageSlugs, recentPostSlugs] = await Promise.all([
    getAllPageSlugs(),
    getRecentPostSlugs(30),
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
  const item = (await getPostBySlug(slug)) ?? (await getPageBySlug(slug));
  if (!item) return {};

  const title = stripHtml(item.title.rendered);
  const description = stripHtml(item.excerpt.rendered) || undefined;
  const image = getFeaturedImage(item);

  return {
    title,
    description,
    openGraph: {
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
  const post = await getPostBySlug(slug);
  const item = post ?? (await getPageBySlug(slug));

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

  const [allCategories, allTags, comments, recentPosts] = await Promise.all([
    getCategories(),
    getTags(),
    getCommentsForPost(post.id, 3),
    getPosts(15),
  ]);

  const mostRead = await getMostReadPosts(
    recentPosts.filter((p) => p.id !== post.id),
    5
  );

  const category = allCategories.find((c) => post.categories?.includes(c.id));
  const tag = allTags.find((t) => post.tags?.includes(t.id));

  return (
    <article>
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
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <div
            className="post-content"
            dangerouslySetInnerHTML={{ __html: post.content.rendered }}
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

          <Link href="/register" className="sidebar-ad">
            <strong>Become a member</strong>
            <span>Join Secret Carshalton — free and paid tiers available.</span>
          </Link>
        </aside>
      </div>
    </article>
  );
}
