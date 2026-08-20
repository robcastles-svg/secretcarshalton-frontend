import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getEventBySlug,
  getEventSchema,
  getFeaturedImage,
  getRecentEventSlugs,
  parseEventDate,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

/** See app/[slug]/page.tsx for the same tradeoff — capped instead of all ~257 events. */
export async function generateStaticParams() {
  const slugs = await getRecentEventSlugs(20);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const title = stripHtml(event.title.rendered);
  const description = stripHtml(event.content.rendered).slice(0, 160) || undefined;
  const image = getFeaturedImage(event);

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

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) notFound();

  const image = getFeaturedImage(event);
  const schema = await getEventSchema(slug).catch(() => null);
  const venue = schema?.location?.[0];
  const startDate = parseEventDate(schema?.startDate);

  return (
    <article className="container">
      <h1 dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
      {startDate && (
        <p>
          <strong>
            {startDate.toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
            })}
          </strong>
          {venue?.name && (
            <>
              {" — "}
              {venue.name}
              {venue.address?.streetAddress ? `, ${venue.address.streetAddress}` : ""}
            </>
          )}
        </p>
      )}
      {image && <img src={image.source_url} alt={image.alt_text} />}
      <div dangerouslySetInnerHTML={{ __html: event.content.rendered }} />
    </article>
  );
}
