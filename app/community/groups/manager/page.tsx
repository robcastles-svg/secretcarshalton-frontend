import Link from "next/link";
import { GROUP_PROMOTION_PRICE } from "@/lib/pricing";

export const metadata = { title: "List your group — Secret Carshalton" };

/**
 * Where "Groups to join"'s own "List your group" button sends people,
 * instead of straight to the submission form — same idea as
 * /events/manager and /directory/featured. Hands off to
 * /community/groups/submit — a deliberately separate, simpler form from
 * the business-focused /directory/submit: no Featured tiers, just free
 * or the flat £10 promotion, kept distinct per Rob's call that groups
 * should read as their own clear, separate thing.
 *
 * The CTA goes straight to /community/groups/submit (no auth check
 * here) — that page already handles the not-signed-in case on its own
 * (redirects back here), so this page doesn't need to duplicate that
 * logic.
 */
export default function GroupsManagerPage() {
  return (
    <main className="container auth-page event-manager-page">
      <h1>List your group</h1>
      <p>
        Run a local club, society or group? List it on Secret Carshalton — it&apos;s free, and you can
        optionally promote it for more reach in the same step.
      </p>

      <ul className="event-manager-benefits">
        <li>A free listing with your name, description and a link — found by anyone browsing Groups to join</li>
        <li>Optional — promote your group to a featured spot within the Community section for {GROUP_PROMOTION_PRICE}</li>
        <li>Manage everything yourself — add and edit your listing from your dashboard, any time</li>
        <li>Completely free to list</li>
      </ul>

      <div className="advertise-cta-box">
        <Link href="/community/groups/submit" className="button-pill">
          List your group
        </Link>
        <p className="dashboard-hint">
          New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
        </p>
      </div>
    </main>
  );
}
