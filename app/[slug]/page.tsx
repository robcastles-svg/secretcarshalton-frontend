import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllPageSlugs,
  getAllPostSlugs,
  getFeaturedImage,
  getPageBySlug,
  getPostBySlug,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const [postSlugs, pageSlugs] = await Promise.all([getAllPostSlugs(), getAllPageSlugs()]);
  const slugs = new Set([...postSlugs, ...pageSlugs]);
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
