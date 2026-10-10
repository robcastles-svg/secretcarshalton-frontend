"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronIcon } from "./EvIcons";

/**
 * "Back to event" when the visitor came from an event page (which links to
 * the organiser and venue pages with ?from=<event-slug>), otherwise "Back
 * to events". Read on the client so those pages stay statically cached.
 * Shared by the organiser and venue pages.
 */
export function BackToEvent() {
  const from = useSearchParams().get("from");
  const safe = from && /^[a-z0-9-]+$/i.test(from) ? from : null;
  return (
    <Link href={safe ? `/events/${safe}` : "/events"} className="evx-back">
      <ChevronIcon />
      {safe ? "Back to event" : "Back to events"}
    </Link>
  );
}
