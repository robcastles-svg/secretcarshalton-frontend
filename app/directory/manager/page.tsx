import Link from "next/link";

export const metadata = { title: "Directory Manager — Secret Carshalton" };

/**
 * Where /directory/submit sends a logged-out visitor instead of dropping
 * them straight on /login with no context — same idea as /events/manager
 * (which this mirrors): explain why it's worth creating an account first,
 * then offer the login/register routes in. Covers both businesses and
 * community groups, since they're the same free listing underneath (see
 * SubmitListingForm) — just a different category.
 */
export default function DirectoryManagerPage() {
  return (
    <main className="container auth-page event-manager-page">
      <h1>Directory Manager</h1>
      <p>
        It&rsquo;s free, quick and simple to add your business, organisation or community group to Secret
        Carshalton — and once you&rsquo;re signed in, you can add and edit your listing yourself, any time, from
        your own dashboard.
      </p>

      <ul className="event-manager-benefits">
        <li>A free listing with your name, website and category — found by anyone searching the directory</li>
        <li>Optional paid extras when you want more reach — a Featured listing, or a Community Group Promotion</li>
        <li>Manage everything yourself — add and edit your listing from your dashboard, any time</li>
        <li>Completely free to submit</li>
      </ul>

      <p className="dashboard-hint">
        Running a local business?{" "}
        <Link href="/directory/featured">See what Featured includes</Link> before you add your listing — it&apos;s
        a fuller profile with photos, top placement and more, from £50/month.
      </p>

      <div className="advertise-cta-box">
        <Link href="/login?next=/directory/submit" className="button-pill">
          Log in to add your listing
        </Link>
        <p className="dashboard-hint">
          New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
        </p>
      </div>
    </main>
  );
}
