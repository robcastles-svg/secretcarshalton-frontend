import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HIDDEN_TOPICS } from "@/lib/event-list";
import { getScEventTags } from "@/lib/wordpress";
import { EventsAreaBar } from "../../_components/EventsAreaBar";
import { EventsListPage, listMetadata } from "../../_components/EventsListPage";
import { cleanTopic } from "../../_components/listParams";

export const revalidate = 3600;

type Props = { params: Promise<{ topic: string }> };

export async function generateStaticParams() {
  const tags = await getScEventTags().catch(() => []);
  return [{ topic: "free" }, ...tags.filter((t) => !HIDDEN_TOPICS.has(t.slug)).map((t) => ({ topic: t.slug }))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = await cleanTopic((await params).topic);
  return topic ? listMetadata({ when: "all", topic }) : {};
}

/** e.g. /events/category/music, /events/category/free (Free comes from the price field). */
export default async function CategoryPage({ params }: Props) {
  const topic = await cleanTopic((await params).topic);
  if (!topic) notFound();
  return (
    <>
      <EventsAreaBar />
      <EventsListPage filter={{ when: "all", topic }} />
    </>
  );
}
