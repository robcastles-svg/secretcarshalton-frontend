import Link from "next/link";

export const metadata = { title: "Event Manager — Secret Carshalton" };

/**
 * Where /events/submit sends a logged-out visitor instead of dropping them
 * straight on /login with no context — explains why it's worth creating an
 * account just to add an event, then offers the login/register routes in.
 * Copy adapted from the old EventON "Add Event" page's own logged-out
 * view (staging19.secretcarshalton.com/add-event), which already made this
 * same pitch well; "Event Manager" itself is that page's own name for this
 * feature, reused here and on the dashboard rather than inventing a new one.
 */
export default function EventManagerPage() {
  return (
    <main className="container auth-page event-manager-page">
      <h1>Event Manager</h1>
      <p>
        It&rsquo;s free, quick and simple to add your own event to Secret Carshalton — and once you&rsquo;re
        signed in, you can add, edit and feature your events yourself, any time, from your own dashboard.
      </p>

      <ul className="event-manager-benefits">
        <li>Reach hundreds of people looking to see what&rsquo;s on, right now</li>
        <li>Newly-added events get shared on our Facebook and Instagram stories</li>
        <li>Manage everything yourself — add, edit and feature events from your dashboard, any time</li>
        <li>Completely free to submit</li>
      </ul>

      <p className="dashboard-hint">
        Tip: sharing an event at least a month in advance is the most successful way to gain views.
      </p>

      <div className="advertise-cta-box">
        <Link href="/login?next=/events/submit" className="button-pill">
          Log in to add your event
        </Link>
        <p className="dashboard-hint">
          New here? <Link href="/register">Create a free account</Link> — it only takes a minute.
        </p>
      </div>
    </main>
  );
}
