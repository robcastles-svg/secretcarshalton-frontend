"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MyListing, WPScEventCategory, WPScEventTag } from "@/lib/wordpress";

export interface EventFormInitial {
  title: string;
  description: string;
  start: string;
  end: string;
  venue_name: string;
  venue_address: string;
  organizer: string;
  event_url: string;
  category: string;
  tags: string[];
  listing_id: string;
}

/**
 * Shared by /events/submit (create, always lands as 'pending') and
 * /events/[slug]/edit (update, owner-only) — same fields either way, just
 * a different endpoint and a different "what happens after" story. Edit
 * pre-fills from the existing event; submit starts blank.
 */
export function EventForm({
  mode,
  eventId,
  eventSlug,
  categories,
  tags,
  listings,
  initial,
}: {
  mode: "create" | "edit";
  eventId?: number;
  eventSlug?: string;
  categories: WPScEventCategory[];
  tags: WPScEventTag[];
  listings: MyListing[];
  initial?: EventFormInitial;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const data: Record<string, string | string[]> = {};
    for (const key of ["title", "description", "start", "end", "venue_name", "venue_address", "organizer", "event_url", "category", "listing_id"]) {
      data[key] = String(form.get(key) ?? "");
    }
    data.tags = selectedTags;

    const endpoint = mode === "create" ? "/api/events/submit" : `/api/events/${eventId}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      if (mode === "edit" && eventSlug) {
        router.push(`/events/${eventSlug}`);
        router.refresh();
      } else {
        setDone(true);
        router.refresh();
      }
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  function toggleTag(slug: string) {
    setSelectedTags((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));
  }

  if (done && mode === "create") {
    return <p>Thanks — your event has been submitted and is awaiting review.</p>;
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Event title
        <input type="text" name="title" defaultValue={initial?.title} required />
      </label>
      <label>
        Description
        <textarea name="description" rows={4} defaultValue={initial?.description} />
      </label>
      <label>
        Start date/time
        <input type="datetime-local" name="start" defaultValue={initial?.start} required />
      </label>
      <label>
        End date/time
        <input type="datetime-local" name="end" defaultValue={initial?.end} />
      </label>
      <label>
        Venue name
        <input type="text" name="venue_name" defaultValue={initial?.venue_name} />
      </label>
      <label>
        Venue address
        <input type="text" name="venue_address" defaultValue={initial?.venue_address} />
      </label>
      <label>
        Organiser
        <input type="text" name="organizer" defaultValue={initial?.organizer} />
      </label>
      <label>
        Event website/link
        <input type="url" name="event_url" placeholder="https://" defaultValue={initial?.event_url} />
      </label>
      {listings.length > 0 && (
        <label>
          Business or organisation this event belongs to (optional)
          <select name="listing_id" defaultValue={initial?.listing_id ?? ""}>
            <option value="">None — this is just me</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <span className="event-form-hint">
            Shows &quot;Hosted by [business]&quot; on the event instead of your personal profile.
          </span>
        </label>
      )}
      {categories.length > 0 && (
        <label>
          Category
          <select name="category" defaultValue={initial?.category ?? ""}>
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {tags.length > 0 && (
        <fieldset className="event-form-tags">
          <legend>Topics</legend>
          {tags.map((t) => (
            <label key={t.id} className="event-form-tag-checkbox">
              <input
                type="checkbox"
                checked={selectedTags.includes(t.slug)}
                onChange={() => toggleTag(t.slug)}
              />
              {t.name}
            </label>
          ))}
        </fieldset>
      )}
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Saving…" : mode === "create" ? "Submit event" : "Save changes"}
      </button>
    </form>
  );
}
