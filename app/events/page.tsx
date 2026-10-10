import type { Metadata } from "next";
import { EventsAreaBar } from "./_components/EventsAreaBar";
import { EventsListPage, listMetadata } from "./_components/EventsListPage";

export const revalidate = 3600;

/**
 * All upcoming events. The old ?year=&month=, ?category=, ?tag= and
 * ?view=calendar addresses are redirected to the new list pages by
 * proxy.ts before they reach here.
 */
export async function generateMetadata(): Promise<Metadata> {
  return listMetadata({ when: "all" });
}

export default function EventsPage() {
  return (
    <>
      <EventsAreaBar />
      <EventsListPage filter={{ when: "all" }} />
    </>
  );
}
