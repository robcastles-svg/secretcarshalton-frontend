"use client";

import Link from "next/link";
import { useState } from "react";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import { CalendarIcon, ChevronIcon } from "../../_components/EvIcons";

/** "£5 per event" → "£5" */
const FEATURE_PRICE = EVENT_UPGRADE_PRICE.split(" ")[0];

export interface LiveEventRow {
  id: number;
  slug: string;
  title: string;
  dateLabel: string;
  thumbnail: string;
  views: number;
  featured: boolean;
  repeating: boolean;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * "Your live events" on the add-event page: a collapsible light-grey panel
 * listing the member's live events, each with views, Edit, Delete (with an
 * "Are you sure?" step) and the featuring state. Featuring goes through the
 * existing feature-request page until PayPal is wired in (Stage 5).
 */
export function LiveEventsPanel({ events }: { events: LiveEventRow[] }) {
  const [rows, setRows] = useState(events);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function remove(id: number) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(null);
    if (res.ok) {
      setRows((r) => r.filter((e) => e.id !== id));
      setMessage({ kind: "ok", text: "Event deleted." });
    } else {
      setMessage({ kind: "err", text: body.error || "Sorry, that didn't work. Please try again." });
    }
  }

  if (events.length === 0) return null;

  return (
    <details className="evf-live">
      <summary>
        Your live events <span className="evx-count">{rows.length}</span>
        <span className="evf-live-hint">Edit, delete or feature</span>
        <ChevronIcon />
      </summary>
      <div className="evf-live-list">
        {message && <div className={`evf-msg evf-msg-${message.kind}`}>{message.text}</div>}
        {rows.map((e) => (
          <div className="evf-my-row" key={e.id}>
            {e.thumbnail ? <img src={e.thumbnail} alt="" /> : <span className="evf-my-noimg" aria-hidden="true" />}
            <div className="evf-my-t">
              <Link href={`/events/${e.slug}`}>
                <b>{e.title}</b>
              </Link>
              <small>
                <span>
                  <CalendarIcon />
                  {e.dateLabel}
                </span>
                <span>
                  <EyeIcon />
                  {e.views.toLocaleString("en-GB")} views
                </span>
              </small>
            </div>
            <div className="evf-my-acts">
              {e.featured ? (
                <span className="evf-tag-featured">Featured until event date</span>
              ) : e.repeating ? (
                <span className="evf-muted">Featuring is for single events</span>
              ) : (
                <Link className="evx-btn evx-btn-sm evf-btn-feature" href={`/events/${e.slug}/feature`}>
                  Feature {FEATURE_PRICE}
                </Link>
              )}
              <Link className="evx-btn evx-btn-sm" href={`/events/${e.slug}/edit`}>
                Edit
              </Link>
              <button type="button" className="evx-btn evx-btn-sm evf-danger" onClick={() => setConfirming(e.id)}>
                Delete
              </button>
            </div>
            {confirming === e.id && (
              <div className="evf-my-confirm" role="alert">
                <span>Delete this event? It will be removed from the site straight away.</span>
                <button type="button" className="evx-btn evx-btn-sm evf-del-yes" disabled={busy} onClick={() => remove(e.id)}>
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <button type="button" className="evx-btn evx-btn-sm" onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
