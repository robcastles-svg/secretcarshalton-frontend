import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { getEventOrganizers, getEventVenues, getMyListings, getScEventCategories, getScEventTags } from "@/lib/wordpress";
import { EventForm } from "../_components/EventForm";

export const metadata = { title: "Submit an event — Secret Carshalton" };

export default async function EventsSubmitPage() {
  const token = await getSessionToken();
  if (!token) redirect("/events/manager");

  const [categories, tags, listings, venues, organizers] = await Promise.all([
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getMyListings(token),
    getEventVenues().catch(() => []),
    getEventOrganizers().catch(() => []),
  ]);

  return (
    <main className="container auth-page">
      <h1>Submit an event</h1>
      <p>Running something local? Submit it here — events are reviewed before they go live.</p>
      <EventForm mode="create" categories={categories} tags={tags} listings={listings} venues={venues} organizers={organizers} />
    </main>
  );
}
