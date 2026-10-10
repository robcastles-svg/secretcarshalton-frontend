import type { Metadata } from "next";
import { EventsAreaBar } from "../_components/EventsAreaBar";
import { EventsListPage, listMetadata } from "../_components/EventsListPage";
import { cleanTopic } from "../_components/listParams";

type Props = { searchParams: Promise<{ topic?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listMetadata({ when: "weekend", topic: await cleanTopic((await searchParams).topic) });
}

/** "Things to do this weekend" — with a friendly empty state when nothing's on. */
export default async function ThisWeekendPage({ searchParams }: Props) {
  const topic = await cleanTopic((await searchParams).topic);
  return (
    <>
      <EventsAreaBar />
      <EventsListPage filter={{ when: "weekend", topic }} />
    </>
  );
}
