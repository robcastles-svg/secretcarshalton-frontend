import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import {
  getMemberMe,
  getScEventBySlug,
  getScEventCategories,
  getScEventTags,
  stripHtml,
} from "@/lib/wordpress";
import { EventForm, type EventFormInitial } from "../../_components/EventForm";

export const metadata = { title: "Edit event — Secret Carshalton" };

/** datetime-local inputs want "YYYY-MM-DDTHH:mm" — sc_start/sc_end are already that shape, just possibly with seconds. */
function toDatetimeLocal(raw?: string): string {
  if (!raw) return "";
  return raw.slice(0, 16);
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect("/login");

  const [event, profile, categories, tags] = await Promise.all([
    getScEventBySlug(slug).catch(() => null),
    getMemberMe(token),
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
  ]);

  if (!event) notFound();
  if (!profile) redirect("/login");

  // Ownership is the real security boundary server-side (SC_Events_REST::check_owns_event) —
  // this is just so a non-owner doesn't land on a form that will 403 on submit.
  if (profile.id !== event.author) {
    redirect(`/events/${slug}`);
  }

  const category = categories.find((c) => event.sc_event_category?.includes(c.id));
  const eventTags = tags.filter((t) => event.sc_event_tag?.includes(t.id));

  const initial: EventFormInitial = {
    title: stripHtml(event.title.rendered),
    description: stripHtml(event.content.rendered),
    start: toDatetimeLocal(event.meta.sc_start),
    end: toDatetimeLocal(event.meta.sc_end),
    venue_name: event.meta.sc_venue_name ?? "",
    venue_address: event.meta.sc_venue_address ?? "",
    organizer: event.meta.sc_organizer ?? "",
    event_url: event.meta.sc_event_url ?? "",
    category: category?.slug ?? "",
    tags: eventTags.map((t) => t.slug),
  };

  return (
    <main className="container auth-page">
      <h1>Edit event</h1>
      <EventForm
        mode="edit"
        eventId={event.id}
        eventSlug={event.slug}
        categories={categories}
        tags={tags}
        initial={initial}
      />
    </main>
  );
}
