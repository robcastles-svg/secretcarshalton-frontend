"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MyListing, WPEventVenue, WPScEventCategory, WPScEventTag } from "@/lib/wordpress";

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

const NEW_VENUE = "__new__";

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
  venues,
  initial,
}: {
  mode: "create" | "edit";
  eventId?: number;
  eventSlug?: string;
  categories: WPScEventCategory[];
  tags: WPScEventTag[];
  listings: MyListing[];
  venues: WPEventVenue[];
  initial?: EventFormInitial;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);

  // Editing an existing event whose venue isn't in the known list yet
  // (it was the only one to ever use that name) still needs to land on
  // the free-text "new location" input, not silently reset to blank.
  const initialIsKnownVenue = Boolean(
    initial?.venue_name && venues.some((v) => v.name === initial.venue_name)
  );
  const [addingNewVenue, setAddingNewVenue] = useState(
    Boolean(initial?.venue_name) && !initialIsKnownVenue
  );
  const [venueName, setVenueName] = useState(initial?.venue_name ?? "");
  const [venueAddress, setVenueAddress] = useState(initial?.venue_address ?? "");

  function handleVenueSelect(value: string) {
    if (value === NEW_VENUE) {
      setAddingNewVenue(true);
      setVenueName("");
      setVenueAddress("");
      return;
    }
    setAddingNewVenue(false);
    setVenueName(value);
    setVenueAddress(venues.find((v) => v.name === value)?.address ?? "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const data: Record<string, string | string[]> = {};
    for (const key of ["title", "description", "start", "end", "organizer", "event_url", "category", "listing_id"]) {
      data[key] = String(form.get(key) ?? "");
    }
    data.venue_name = venueName;
    data.venue_address = venueAddress;
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
        Venue
        <select value={addingNewVenue ? NEW_VENUE : venueName} onChange={(e) => handleVenueSelect(e.target.value)}>
          <option value="">Select a venue…</option>
          {venues.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
          <option value={NEW_VENUE}>+ Add a new location</option>
        </select>
      </label>
      {addingNewVenue && (
        <label>
          New venue name
          <input
            type="text"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Venue name"
          />
        </label>
      )}
      <label>
        Venue address
        <input type="text" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
      </label>
      <label>
        Organiser / company name
        <input type="text" name="organizer" defaultValue={initial?.organizer} placeholder="e.g. Carshalton Rotary Club" />
        <span className="event-form-hint">
          The name shown publicly as who&apos;s running this event — a business or group name, not a personal one.
        </span>
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
            Shows &quot;Hosted by [business]&quot; on the event instead of the Organiser name above.
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
