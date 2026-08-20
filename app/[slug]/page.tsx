import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllPageSlugs,
  getFeaturedImage,
  getPageBySlug,
  getPostBySlug,
  getRecentPostSlugs,
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

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = (await getPostBySlug(slug)) ?? (await getPageBySlug(slug));

  if (!item) notFound();

  const image = getFeaturedImage(item);

  return (
    <article className="container">
      <h1 dangerouslySetInnerHTML={{ __html: item.title.rendered }} />
      <time dateTime={item.date}>
        {new Date(item.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </time>
      {image && <img src={image.source_url} alt={image.alt_text} />}
      <div dangerouslySetInnerHTML={{ __html: item.content.rendered }} />
    </article>
  );
}
