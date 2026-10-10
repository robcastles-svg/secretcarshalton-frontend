"use client";

import Link from "next/link";
import { useState } from "react";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import { CalendarIcon, ChevronIcon } from "../../_components/EvIcons";
import { FeatureEventPay } from "../../_components/FeatureEventPay";

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
 * "Are you sure?" step) and the featuring state. "Feature £5" opens a
 * pop-up with the PayPal buttons (Stage 5).
 */
export function LiveEventsPanel({ events }: { events: LiveEventRow[] }) {
  const [rows, setRows] = useState(events);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [featuring, setFeaturing] = useState<LiveEventRow | null>(null);

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

  return (
    <details className="evf-live">
      <summary>
        Your live events <span className="evx-count">{rows.length}</span>
        <span className="evf-live-hint">Edit, delete or feature</span>
        <ChevronIcon />
      </summary>
      <div className="evf-live-list">
        {message && <div className={`evf-msg evf-msg-${message.kind}`}>{message.text}</div>}
        {rows.length === 0 && (
          <p className="evf-live-empty">
            You don&apos;t have any upcoming events at the moment. Events you add will appear here, ready to edit.
          </p>
        )}
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
                <button type="button" className="evx-btn evx-btn-sm evf-btn-feature" onClick={() => setFeaturing(e)}>
                  Feature {FEATURE_PRICE}
                </button>
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
        <Link className="evf-live-all" href="/dashboard">
          See all your events, including past ones, on your dashboard →
        </Link>
      </div>
      {featuring && (
        <div className="evf-modal-wrap" onClick={(ev) => ev.target === ev.currentTarget && setFeaturing(null)}>
          <div className="evf-modal" role="dialog" aria-modal="true" aria-labelledby="evf-feature-title">
            <h2 id="evf-feature-title">Feature your event</h2>
            <p>{featuring.title}</p>
            <div className="evf-upgrade">
              <h3>Get more people to see it</h3>
              <p>
                Your event goes to the top of the events list and into the rotating highlight on the homepage, until the
                event date.
              </p>
              <div className="evf-cost">
                {FEATURE_PRICE} <span>one-off payment</span>
              </div>
              <FeatureEventPay
                eventId={featuring.id}
                onPaid={() => setRows((r) => r.map((x) => (x.id === featuring.id ? { ...x, featured: true } : x)))}
              />
              <button type="button" className="evx-btn" onClick={() => setFeaturing(null)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
