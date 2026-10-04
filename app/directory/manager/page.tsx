import Link from "next/link";

export const metadata = { title: "Directory Manager — Secret Carshalton" };

/**
 * Where /directory/submit sends a logged-out visitor instead of dropping
 * them straight on /login with no context — same idea as /events/manager
 * (which this mirrors): explain why it's worth creating an account first,
 * then offer the login/register routes in. Covers both businesses and
 * community groups, since they're the same free listing underneath (see
 * SubmitListingForm) — just a different category.
 *
 * Forwards an incoming ?tier= (from /advertise's Featured CTAs) through
 * the login detour, so picking "Choose Featured Gold" while logged out
 * still lands on that tier pre-selected after signing in, instead of
 * silently resetting to Free.
 */
export default async function DirectoryManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;
  const submitTarget = tier ? `/directory/submit?tier=${encodeURIComponent(tier)}` : "/directory/submit";

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
        Running a local business? Once you&apos;re signed in, the same form lets you go Featured — a fuller
        profile with photos, top placement and more, from £50/month — in one step.
      </p>

      <div className="advertise-cta-box">
        <Link href={`/login?next=${encodeURIComponent(submitTarget)}`} className="button-pill">
          Log in to add your listing
        </Link>
        <p className="dashboard-hint">
          New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
        </p>
      </div>
    </main>
  );
}
