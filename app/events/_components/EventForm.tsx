"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MyListing, WPEventOrganizer, WPEventVenue, WPScEventCategory, WPScEventTag } from "@/lib/wordpress";

export interface EventFormInitial {
  title: string;
  description: string;
  start: string;
  end: string;
  venue_name: string;
  venue_address: string;
  /** Legacy free-text organiser name — still shown/sent for events that predate the organiser picker below. */
  organizer: string;
  event_url: string;
  /** Term ID of the attached sc_event_organizer profile, if any — takes priority over the legacy `organizer` text above. */
  organizer_id: string;
  category: string;
  tags: string[];
  listing_id: string;
}

const NEW_VENUE = "__new__";
const NEW_ORGANIZER = "__new__";

/**
 * Shared by /events/submit (create, goes live straight away) and
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
  organizers,
  initial,
}: {
  mode: "create" | "edit";
  eventId?: number;
  eventSlug?: string;
  categories: WPScEventCategory[];
  tags: WPScEventTag[];
  listings: MyListing[];
  venues: WPEventVenue[];
  organizers: WPEventOrganizer[];
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

  // Same "land on the free-text input, don't silently drop it" reasoning
  // as the venue state above: an event whose organiser was only ever the
  // legacy sc_organizer text (no profile attached yet) should open on
  // "add a new organiser" pre-filled with that name, not a blank picker.
  const [addingNewOrganizer, setAddingNewOrganizer] = useState(
    Boolean(initial?.organizer) && !initial?.organizer_id
  );
  const [organizerId, setOrganizerId] = useState(initial?.organizer_id ?? "");
  const [organizerName, setOrganizerName] = useState(
    !initial?.organizer_id ? initial?.organizer ?? "" : ""
  );
  const [organizerAddress, setOrganizerAddress] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [organizerUrl, setOrganizerUrl] = useState("");
  const [organizerSocials, setOrganizerSocials] = useState("");

  function handleOrganizerSelect(value: string) {
    if (value === NEW_ORGANIZER) {
      setAddingNewOrganizer(true);
      setOrganizerId("");
      setOrganizerName("");
      setOrganizerAddress("");
      setOrganizerPhone("");
      setOrganizerUrl("");
      setOrganizerSocials("");
      return;
    }
    setAddingNewOrganizer(false);
    setOrganizerId(value);
  }

  const selectedOrganizer = organizers.find((o) => String(o.id) === organizerId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const data: Record<string, string | string[]> = {};
    for (const key of ["title", "description", "start", "end", "event_url", "category", "listing_id"]) {
      data[key] = String(form.get(key) ?? "");
    }
    data.venue_name = venueName;
    data.venue_address = venueAddress;
    data.tags = selectedTags;

    // See SC_Events_REST::set_organizer_from_request's docblock: organizer_id
    // present (even "") means "attach this term or clear the association";
    // its total absence is what signals "attach a brand new one by name".
    if (addingNewOrganizer) {
      data.organizer_name = organizerName;
      data.organizer_address = organizerAddress;
      data.organizer_phone = organizerPhone;
      data.organizer_url = organizerUrl;
      data.organizer_socials = organizerSocials;
    } else {
      data.organizer_id = organizerId;
    }

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
    return <p>Thanks — your event is live. You can edit it any time from your dashboard.</p>;
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
        Organiser
        <select value={addingNewOrganizer ? NEW_ORGANIZER : organizerId} onChange={(e) => handleOrganizerSelect(e.target.value)}>
          <option value="">No organiser / just me</option>
          {organizers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value={NEW_ORGANIZER}>+ Add a new organiser</option>
        </select>
        <span className="event-form-hint">
          Who&apos;s running this event — a business or group, not a personal name. Picking an existing organiser
          links this event to every other event they&apos;ve run.
        </span>
      </label>
      {!addingNewOrganizer && selectedOrganizer && (
        <p className="event-form-hint">
          {[selectedOrganizer.address, selectedOrganizer.phone, selectedOrganizer.url]
            .filter(Boolean)
            .join(" · ") || "No contact details on file for this organiser yet."}
        </p>
      )}
      {addingNewOrganizer && (
        <>
          <label>
            Organiser name
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              placeholder="e.g. Carshalton Rotary Club"
            />
          </label>
          <label>
            Organiser address
            <input type="text" value={organizerAddress} onChange={(e) => setOrganizerAddress(e.target.value)} />
          </label>
          <label>
            Organiser phone
            <input type="tel" value={organizerPhone} onChange={(e) => setOrganizerPhone(e.target.value)} />
          </label>
          <label>
            Organiser website
            <input type="url" value={organizerUrl} onChange={(e) => setOrganizerUrl(e.target.value)} placeholder="https://" />
          </label>
          <label>
            Organiser social links
            <input
              type="text"
              value={organizerSocials}
              onChange={(e) => setOrganizerSocials(e.target.value)}
              placeholder="Facebook, Instagram, etc — paste links separated by commas"
            />
          </label>
        </>
      )}
      <label>
        Event-specific link (optional)
        <input type="url" name="event_url" placeholder="https://" defaultValue={initial?.event_url} />
        <span className="event-form-hint">
          Please link to the actual booking or ticket page — not your social media profile or a generic homepage —
          it makes the listing more useful for readers. Add your business or group&apos;s own details under
          Organiser above. Leave this blank if there&apos;s no external booking page.
        </span>
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
