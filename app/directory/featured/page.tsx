import Link from "next/link";
import { SOCIAL_REACH_BLURB } from "@/lib/socialStats";

export const metadata = { title: "Featured directory listing — Secret Carshalton" };

/**
 * Where the Directory page's main "Add a listing" button now sends people,
 * instead of straight to the free listing form — same idea as
 * /events/manager: lead with the benefit of the thing worth paying for,
 * free stays one click away underneath for anyone who just wants that.
 *
 * The primary CTA goes to /dashboard/upgrade rather than straight to a
 * form here — that page already handles every case (not signed in yet,
 * signed in but no listing to upgrade, already featured/pending) without
 * duplicating that logic.
 */
export default function FeaturedListingPage() {
  return (
    <main className="container auth-page event-manager-page">
      <h1>Featured directory listing</h1>
      <p>
        The long-form version of a free listing — your full details, photos and socials, plus a featured
        spot at the top of your category on both Directory and Discover.
      </p>

      <ul className="event-manager-benefits">
        <li>Around 150 views a month from your category pages alone</li>
        <li>Top ranking, above every free listing in your category</li>
        <li>A mention in our Facebook/Instagram stories — we reach {SOCIAL_REACH_BLURB}</li>
      </ul>

      <p className="advertise-price">
        <strong>£10/month</strong>
        <span className="advertise-price-note"> — billed annually (£120/year), cancel any time.</span>
      </p>

      <div className="advertise-cta-box">
        <Link href="/dashboard/upgrade" className="button-pill">
          Get a featured listing
        </Link>
        <p className="dashboard-hint">
          Just want the basics? <Link href="/directory/submit">Add a free listing</Link> instead.
        </p>
      </div>
    </main>
  );
}
