"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubmitEventForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data = Object.fromEntries(new FormData(e.currentTarget).entries());

    const res = await fetch("/api/events/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return <p>Thanks — your event has been submitted and is awaiting review.</p>;
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Event title
        <input type="text" name="title" required />
      </label>
      <label>
        Description
        <textarea name="description" rows={4} />
      </label>
      <label>
        Start date/time
        <input type="datetime-local" name="start" required />
      </label>
      <label>
        End date/time
        <input type="datetime-local" name="end" />
      </label>
      <label>
        Venue name
        <input type="text" name="venue_name" />
      </label>
      <label>
        Venue address
        <input type="text" name="venue_address" />
      </label>
      <label>
        Organiser
        <input type="text" name="organizer" />
      </label>
      <label>
        Event website/link
        <input type="url" name="event_url" placeholder="https://" />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit event"}
      </button>
    </form>
  );
}
