import Link from "next/link";
import { getSessionToken } from "@/lib/auth";

/**
 * The events header button: "Submit / manage events" for signed-in
 * members (the add-event page is also where they manage their live
 * events), "Submit an event" otherwise. Same cookie-read-in-Suspense
 * pattern as UtilityNavAuth, so the list page itself stays cached.
 */
export async function SubmitEventButton() {
  const token = await getSessionToken();
  return (
    <Link className="evl-btn-submit" href="/events/submit">
      {token ? "Submit / manage events" : "Submit an event"}
    </Link>
  );
}
