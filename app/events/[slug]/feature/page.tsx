import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { getMyEvents } from "@/lib/wordpress";
import { SubmitFeatureRequest } from "./_components/SubmitFeatureRequest";

export const metadata = { title: "Feature your event — Secret Carshalton" };

export default async function FeatureEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect(`/login?next=/events/${slug}/feature`);

  // /mine is already scoped to events this member owns — same boundary
  // request-featured itself enforces server-side, so no separate
  // ownership check is needed here the way the edit page needs one.
  const events = await getMyEvents(token);
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();

  if (event.status !== "publish") {
    redirect("/dashboard");
  }

  return (
    <main className="container auth-page">
      <h1>Feature your event</h1>
      <p>
        Pay to feature <strong>{event.title}</strong> at the top of Events and in search — the same way a
        directory upgrade works today.
      </p>

      {event.featured ? (
        <>
          <p className="dashboard-hint">This event is already featured.</p>
          <Link href="/dashboard" className="button-pill button-pill-secondary">
            Back to dashboard
          </Link>
        </>
      ) : event.featuredStatus === "pending" ? (
        <>
          <p className="dashboard-hint">You already have a request pending review for this event.</p>
          <Link href="/dashboard" className="button-pill button-pill-secondary">
            Back to dashboard
          </Link>
        </>
      ) : (
        <SubmitFeatureRequest eventId={event.id} />
      )}
    </main>
  );
}
