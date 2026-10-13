"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUDIENCES, type AdminMessage } from "@/lib/notifications";

const STATE_LABEL: Record<AdminMessage["state"], string> = {
  live: "Live",
  scheduled: "Scheduled",
  ended: "Ended",
  draft: "Draft",
};

function formatDay(ymd: string) {
  if (!ymd) return "";
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function showing(m: AdminMessage) {
  if (m.start && m.end) return `${formatDay(m.start)} – ${formatDay(m.end)}`;
  if (m.end) return `Until ${formatDay(m.end)}`;
  if (m.start) return `From ${formatDay(m.start)}`;
  return "—";
}

function emailLine(m: AdminMessage) {
  if (!m.email) return null;
  if (m.email_status === "") return m.state === "scheduled" ? "Emails on start day" : "Email on publish";
  if (m.email_status === "stopped") return `Email stopped · ${m.email_sent} sent`;
  const failed = m.email_failed ? ` · ${m.email_failed} failed` : "";
  const sending = m.email_status === "sending" ? " (sending…)" : "";
  return `Emailed ${m.email_sent} of ${m.email_total}${failed}${sending}`;
}

/** Rob's list of member messages, from the Editorial box on his dashboard. */
export function MessagesList() {
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [error, setError] = useState("");
  const [postal, setPostal] = useState("");
  const [postalSaved, setPostalSaved] = useState("");
  const [savingPostal, setSavingPostal] = useState(false);

  useEffect(() => {
    fetch("/api/notify/messages")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error);
        setMessages(d);
      })
      .catch((e: Error) => setError(e.message || "Couldn't load messages."));
    fetch("/api/notify/messages/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setPostal(d.postal_address);
          setPostalSaved(d.postal_address);
        }
      })
      .catch(() => undefined);
  }, []);

  const savePostal = async () => {
    setSavingPostal(true);
    try {
      const r = await fetch("/api/notify/messages/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postal_address: postal }),
      });
      if (r.ok) setPostalSaved((await r.json()).postal_address);
    } finally {
      setSavingPostal(false);
    }
  };

  const audienceLabel = (keys: string[]) =>
    keys.map((k) => AUDIENCES.find((a) => a.key === k)?.label ?? k).join(", ");

  return (
    <>
      <p className="msg-admin-back">
        <Link href="/dashboard">← Your dashboard</Link>
      </p>
      <div className="msg-admin-head">
        <div>
          <h1>Member messages</h1>
          <p className="dashboard-hint">
            Messages show at the top of each chosen member&apos;s notification bell, and can be emailed too.
          </p>
        </div>
        <Link href="/admin/messages/new" className="button-pill">
          + New message
        </Link>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {!messages && !error && <p>Loading…</p>}
      {messages && messages.length === 0 && (
        <p className="dash-panel">No messages yet. Write your first one with &ldquo;+ New message&rdquo;.</p>
      )}

      {messages && messages.length > 0 && (
        <div className="msg-admin-table-wrap">
          <table className="msg-admin-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Sent to</th>
                <th>Showing</th>
                <th>Seen</th>
                <th>
                  <span className="dash-sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.title}</strong>
                    <span className={`msg-state msg-state-${m.state}`}>
                      {STATE_LABEL[m.state]}
                      {m.pinned ? " · Pinned" : ""}
                    </span>
                    {emailLine(m) && <span className="msg-admin-email">{emailLine(m)}</span>}
                  </td>
                  <td>{audienceLabel(m.audiences)}</td>
                  <td>{showing(m)}</td>
                  <td>
                    {m.status === "publish" ? `${m.seen} of ${m.reach}` : "—"}
                    {m.dismissed > 0 && <span className="msg-admin-sub">{m.dismissed} dismissed</span>}
                    {m.clicked > 0 && <span className="msg-admin-sub">{m.clicked} clicked</span>}
                  </td>
                  <td>
                    <Link href={`/admin/messages/${m.id}`} className="msg-admin-edit">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="dash-panel msg-admin-settings">
        <h2 className="dash-h3">Email footer address</h2>
        <p className="dashboard-hint">
          UK email rules expect a contact address at the foot of emails like these. A business address or PO box is
          fine — it doesn&apos;t need to be your home.
        </p>
        <div className="msg-admin-settings-row">
          <label htmlFor="postal" className="dash-sr-only">
            Postal address
          </label>
          <input
            id="postal"
            type="text"
            value={postal}
            placeholder="e.g. PO Box 123, Carshalton SM5 2XX"
            onChange={(e) => setPostal(e.target.value)}
          />
          <button
            type="button"
            className="button-pill button-pill-secondary"
            disabled={savingPostal || postal === postalSaved}
            onClick={savePostal}
          >
            {postal === postalSaved && postalSaved ? "Saved" : "Save"}
          </button>
        </div>
      </section>
    </>
  );
}
