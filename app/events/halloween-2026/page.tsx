import type { Metadata } from "next";
import { findCollection } from "@/lib/event-list";
import { EventsAreaBar } from "../_components/EventsAreaBar";
import { CollectionPage, collectionMetadata } from "../_components/CollectionPage";

export const revalidate = 3600;

const collection = findCollection("halloween-2026")!;

export function generateMetadata(): Promise<Metadata> {
  return collectionMetadata(collection);
}

/** Every event Rob has tagged "halloween-2026" in wp-admin, including finished ones. */
export default function Halloween2026Page() {
  return (
    <>
      <EventsAreaBar />
      <CollectionPage collection={collection} />
    </>
  );
}
