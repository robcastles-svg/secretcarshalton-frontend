import type { Metadata } from "next";
import { parseWhenParam } from "@/lib/event-list";
import { EventsAreaBar } from "../events/_components/EventsAreaBar";
import { EventsListPage, listMetadata } from "../events/_components/EventsListPage";
import { cleanTopic } from "../events/_components/listParams";

const AREA = "whats-on-in-carshalton";

type Props = { searchParams: Promise<{ when?: string; topic?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  return listMetadata({ area: AREA, when: parseWhenParam(sp.when), topic: await cleanTopic(sp.topic) });
}

/**
 * Area page — a static route, so it takes precedence over the app/[slug]
 * catch-all that used to serve the old WordPress page at this address.
 * Month and topic filters are query strings (?when=november-2026&topic=music).
 */
export default async function AreaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = { area: AREA, when: parseWhenParam(sp.when), topic: await cleanTopic(sp.topic) };
  return (
    <>
      <EventsAreaBar activeSlug={AREA} />
      <EventsListPage filter={filter} />
    </>
  );
}
