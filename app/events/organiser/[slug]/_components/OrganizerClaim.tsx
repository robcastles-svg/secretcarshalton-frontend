import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { getMyOrganizers } from "@/lib/wordpress";
import { OrganizerClaimForm } from "./OrganizerClaimForm";

/**
 * "Is this your group?" on the organiser page. Reads the visitor's sign-in
 * in its own Suspense boundary (like UtilityNavAuth), so the page itself
 * stays cached:
 * - signed out → sign in to claim
 * - already manages it → straight to where they edit it
 * - a request is waiting → says so
 * - otherwise → "Update these details" opens the request form
 */
export async function OrganizerClaim({
  organizerId,
  slug,
  claimPending,
}: {
  organizerId: number;
  slug: string;
  claimPending: boolean;
}) {
  const token = await getSessionToken();
  if (!token) {
    return (
      <>
        <p>Keep these details up to date, add a logo and manage your events.</p>
        <Link className="evx-btn-dark" href={`/login?next=/events/organiser/${slug}`}>
          Sign in to update these details
        </Link>
      </>
    );
  }
  const mine = await getMyOrganizers(token);
  if (mine.some((o) => o.id === organizerId)) {
    return (
      <>
        <p>You manage this group. Update its details and logo when you add or edit one of its events.</p>
        <Link className="evx-btn-dark" href="/events/submit">
          Manage your events
        </Link>
      </>
    );
  }
  if (claimPending) {
    return <p>A request to manage this group is waiting for review.</p>;
  }
  return <OrganizerClaimForm organizerId={organizerId} />;
}
