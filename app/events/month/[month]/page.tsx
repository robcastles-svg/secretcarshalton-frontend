import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addMonths, currentMonth, monthSlug, parseMonthSlug } from "@/lib/event-list";
import { EventsAreaBar } from "../../_components/EventsAreaBar";
import { EventsListPage, listMetadata } from "../../_components/EventsListPage";
import { cleanTopic } from "../../_components/listParams";

type Props = { params: Promise<{ month: string }>; searchParams: Promise<{ topic?: string }> };

export function generateStaticParams() {
  const first = currentMonth();
  return Array.from({ length: 6 }, (_, n) => ({ month: monthSlug(addMonths(first, n)) }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const when = parseMonthSlug((await params).month);
  if (!when) return {};
  return listMetadata({ when, topic: await cleanTopic((await searchParams).topic) });
}

/** e.g. /events/month/november-2026 — every date in that month, repeating events on each of their dates. */
export default async function MonthPage({ params, searchParams }: Props) {
  const when = parseMonthSlug((await params).month);
  if (!when) notFound();
  const topic = await cleanTopic((await searchParams).topic);
  return (
    <>
      <EventsAreaBar />
      <EventsListPage filter={{ when, topic }} />
    </>
  );
}
