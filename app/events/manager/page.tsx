import { redirect } from "next/navigation";

/**
 * Retired as a separate page — /events/submit is now one page (pitch,
 * how-it-works and the form together, styled like /directory/submit),
 * not a two-step explain-then-form flow with this as the logged-out
 * landing spot. Redirects here for anyone with the old link bookmarked
 * or indexed — same pattern as /jobs/submit's own retirement.
 */
export default function EventsManagerRedirect() {
  redirect("/events/submit");
}
