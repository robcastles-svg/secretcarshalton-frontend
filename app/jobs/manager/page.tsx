import Link from "next/link";
import { JOB_RATE_BRACKETS } from "@/lib/pricing";

export const metadata = { title: "Post a job — Secret Carshalton" };

/**
 * Where the Jobs board's own "Add a job" button sends people, instead of
 * straight to the submission form — same idea as /events/manager and
 * /directory/featured: explain the pricing before the form asks for it.
 * Job posts are always paid (priced by the role's hourly rate), unlike
 * events or directory listings, so there's no "free" framing here.
 *
 * The CTA goes straight to /jobs/submit (no auth check here) — that page
 * already handles the not-signed-in case on its own (redirects to
 * /login), so this page doesn't need to duplicate that logic.
 */
export default function JobsManagerPage() {
  return (
    <main className="container auth-page event-manager-page">
      <h1>Post a job</h1>
      <p>
        Hiring locally? List your vacancy on Secret Carshalton — a paid listing, reviewed before it goes live,
        priced by the role&apos;s hourly rate.
      </p>

      <ul className="event-manager-benefits">
        <li>Placed at the top of the jobs board for the full 7-day run</li>
        <li>Reaches people actively looking for local work</li>
        <li>Automatic expiry — no need to remember to remove it</li>
      </ul>

      {JOB_RATE_BRACKETS.map((b) => (
        <p key={b.slug} className="advertise-price">
          <strong>{b.label}</strong>
          <span className="advertise-price-note"> — {b.price} for 7 days</span>
        </p>
      ))}

      <p className="dashboard-hint">
        There&apos;s no automated payment yet — once you submit your vacancy, we&apos;ll review it and get in
        touch to arrange payment (PayPal). Nothing is charged until then.
      </p>

      <div className="advertise-cta-box">
        <Link href="/jobs/submit" className="button-pill">
          Post a job
        </Link>
        <p className="dashboard-hint">
          New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
        </p>
      </div>
    </main>
  );
}
