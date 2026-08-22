import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getFeaturedImage,
  getRecentScEventSlugs,
  getScEventBySlug,
  parseEventDate,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getRecentScEventSlugs(50).catch(() => []);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getScEventBySlug(slug).catch(() => null);
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
  const event = await getScEventBySlug(slug).catch(() => null);

  if (!event) notFound();

  const image = getFeaturedImage(event);
  const startDate = parseEventDate(event.meta.sc_start);

  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: stripHtml(event.title.rendered),
    startDate: event.meta.sc_start || undefined,
    endDate: event.meta.sc_end || undefined,
    location: event.meta.sc_venue_name
      ? {
          "@type": "Place",
          name: event.meta.sc_venue_name,
          address: event.meta.sc_venue_address || undefined,
        }
      : undefined,
    organizer: event.meta.sc_organizer
      ? { "@type": "Organization", name: event.meta.sc_organizer, url: event.meta.sc_event_url || undefined }
      : undefined,
    image: image ? [image.source_url] : undefined,
  };

  return (
    <article className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
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
          {event.meta.sc_venue_name && (
            <>
              {" — "}
              {event.meta.sc_venue_name}
              {event.meta.sc_venue_address ? `, ${event.meta.sc_venue_address}` : ""}
            </>
          )}
        </p>
      )}
      {image && <img src={image.source_url} alt={image.alt_text} />}
      <div dangerouslySetInnerHTML={{ __html: event.content.rendered }} />
    </article>
  );
}
