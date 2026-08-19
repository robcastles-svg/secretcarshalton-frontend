import { notFound } from "next/navigation";
import { getAllEventSlugs, getEventBySlug, getEventSchema, getFeaturedImage } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllEventSlugs();
  return slugs.map((slug) => ({ slug }));
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

  return (
    <article className="container">
      <h1 dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
      {schema?.startDate && (
        <p>
          <strong>
            {new Date(schema.startDate).toLocaleString("en-GB", {
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
