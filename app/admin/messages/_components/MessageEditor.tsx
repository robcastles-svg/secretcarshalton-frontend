"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCard } from "@/app/_components/notifications/MessageCard";
import { AUDIENCES, type AdminMessage, type AudienceKey } from "@/lib/notifications";

type Form = {
  title: string;
  body: string;
  button_text: string;
  button_url: string;
  audiences: AudienceKey[];
  start: string;
  end: string;
  pinned: boolean;
  dismissible: boolean;
  email: boolean;
  email_subject: string;
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY: Form = {
  title: "",
  body: "",
  button_text: "",
  button_url: "",
  audiences: [],
  start: today(),
  end: "",
  pinned: true,
  dismissible: true,
  email: false,
  email_subject: "",
};

const REASONS: Array<[AudienceKey, string]> = [
  ["premium_listings", "you have a premium listing in the Secret Carshalton directory"],
  ["advertisers", "you advertise on Secret Carshalton"],
  ["event_organisers", "you've added an event on Secret Carshalton"],
  ["listing_owners", "you have a listing in the Secret Carshalton directory"],
  ["community_groups", "you've listed a community group on Secret Carshalton"],
  ["job_posters", "you've posted a job on Secret Carshalton"],
  ["all", "you're a Secret Carshalton member"],
];

/**
 * Write or edit a member message, with live previews of the bell and the
 * email beside the form (the bell preview is the real MessageCard; the
 * email preview mirrors SC_Membership_Messages::render_email). "Send a
 * test to me" saves first, then emails the saved version to Rob.
 */
export function MessageEditor({ id, yourName }: { id?: number; yourName: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<AdminMessage | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState<"" | "publish" | "draft" | "end" | "test">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reach, setReach] = useState<{ members: number; emailable: number; unsubscribed: number } | null>(null);
  const [postal, setPostal] = useState("");

  useEffect(() => {
    fetch("/api/notify/messages/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPostal(d.postal_address))
      .catch(() => undefined);
    if (!id) return;
    fetch(`/api/notify/messages/${id}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error);
        const m = d as AdminMessage;
        setSaved(m);
        setForm({
          title: m.title,
          body: m.body,
          button_text: m.button_text,
          button_url: m.button_url,
          audiences: m.audiences,
          start: m.start,
          end: m.end,
          pinned: m.pinned,
          dismissible: m.dismissible,
          email: m.email,
          email_subject: m.email_subject,
        });
      })
      .catch((e: Error) => setError(e.message || "Couldn't load this message."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (form.audiences.length === 0) {
      setReach(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/notify/messages/reach?audiences=${form.audiences.join(",")}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setReach)
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [form.audiences]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleAudience = (key: AudienceKey) =>
    update("audiences", form.audiences.includes(key) ? form.audiences.filter((a) => a !== key) : [...form.audiences, key]);

  const save = async (status: "publish" | "draft"): Promise<AdminMessage | null> => {
    setError("");
    setNotice("");
    const r = await fetch(saved ? `/api/notify/messages/${saved.id}` : "/api/notify/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, status }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || "Couldn't save the message.");
      return null;
    }
    const m = d as AdminMessage;
    setSaved(m);
    if (!saved) router.replace(`/admin/messages/${m.id}`);
    return m;
  };

  const onSave = async (status: "publish" | "draft") => {
    const emailsNow = status === "publish" && form.email && !(saved && saved.email_status !== "") && form.start <= today();
    if (emailsNow && !confirm(`This emails ${reach ? reach.emailable : "the chosen"} members now. Send it?`)) return;
    setBusy(status);
    try {
      const m = await save(status);
      if (m) {
        setNotice(
          status === "draft"
            ? "Saved as a draft — members can't see it yet."
            : m.state === "scheduled"
              ? `Saved — it'll appear on ${m.start}${m.email ? " and email out then" : ""}.`
              : `Published — it's in the bell now${m.email && m.email_status === "sending" ? ", and the emails are going out" : ""}.`
        );
      }
    } finally {
      setBusy("");
    }
  };

  const onTest = async () => {
    setBusy("test");
    setError("");
    setNotice("");
    try {
      // Sends what's on screen without saving it — so testing a live
      // message can never set off the real send.
      const r = await fetch("/api/notify/messages/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "Couldn't send the test.");
      else setNotice(`Test sent to ${d.sent_to} at ${d.at}. It can take a minute or two to arrive — check spam too.`);
    } finally {
      setBusy("");
    }
  };

  const onEnd = async () => {
    if (!saved || !confirm("End this message now? It disappears from members' bells straight away.")) return;
    setBusy("end");
    try {
      const r = await fetch(`/api/notify/messages/${saved.id}/end`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "Couldn't end the message.");
      else {
        setSaved(d);
        update("end", d.end);
        setNotice("Ended — it's no longer showing.");
      }
    } finally {
      setBusy("");
    }
  };

  if (loading) return <p>Loading…</p>;

  const alreadyEmailed = saved && saved.email_status !== "";
  const reason = REASONS.find(([key]) => form.audiences.includes(key))?.[1] ?? REASONS[REASONS.length - 1][1];
  const previewMessage = { ...form, pinned: form.pinned, dismissible: form.dismissible };

  return (
    <div className="msg-edit">
      <form className="dash-panel msg-edit-form" onSubmit={(e) => e.preventDefault()}>
        <div>
          <p className="msg-admin-back">
            <Link href="/admin/messages">← Member messages</Link>
          </p>
          <h1>{saved ? "Edit message" : "New message"}</h1>
        </div>

        <div className="msg-field">
          <label htmlFor="m-title">Title</label>
          <input id="m-title" type="text" value={form.title} maxLength={120} onChange={(e) => update("title", e.target.value)} />
        </div>
        <div className="msg-field">
          <label htmlFor="m-body">Message</label>
          <textarea id="m-body" rows={5} value={form.body} onChange={(e) => update("body", e.target.value)} />
        </div>
        <div className="msg-field-row">
          <div className="msg-field">
            <label htmlFor="m-btn">
              Button text <span className="msg-optional">(optional)</span>
            </label>
            <input id="m-btn" type="text" value={form.button_text} placeholder="e.g. Try it" onChange={(e) => update("button_text", e.target.value)} />
          </div>
          <div className="msg-field">
            <label htmlFor="m-link">Button link</label>
            <input id="m-link" type="text" value={form.button_url} placeholder="/events/submit or https://…" onChange={(e) => update("button_url", e.target.value)} />
          </div>
        </div>

        <fieldset className="msg-audiences">
          <legend>Who sees it</legend>
          <div className="msg-audience-grid">
            {AUDIENCES.map((a) => (
              <label key={a.key} className="msg-check">
                <input type="checkbox" checked={form.audiences.includes(a.key)} onChange={() => toggleAudience(a.key)} />
                {a.label}
              </label>
            ))}
          </div>
          {reach && (
            <p className="dashboard-hint">
              Reaches <strong>{reach.members} member{reach.members === 1 ? "" : "s"}</strong> right now. People who
              join one of these groups later see it too while it&apos;s showing.
            </p>
          )}
        </fieldset>

        <div className="msg-field-row">
          <div className="msg-field">
            <label htmlFor="m-from">Show from</label>
            <input id="m-from" type="date" value={form.start} onChange={(e) => update("start", e.target.value)} />
          </div>
          <div className="msg-field">
            <label htmlFor="m-until">
              Until <span className="msg-optional">(optional)</span>
            </label>
            <input id="m-until" type="date" value={form.end} min={form.start} onChange={(e) => update("end", e.target.value)} />
          </div>
        </div>

        <div className="msg-checks">
          <label className="msg-check">
            <input type="checkbox" checked={form.pinned} onChange={(e) => update("pinned", e.target.checked)} />
            Pin to the top of the bell
          </label>
          <label className="msg-check">
            <input type="checkbox" checked={form.dismissible} onChange={(e) => update("dismissible", e.target.checked)} />
            Members can dismiss it
          </label>
          <label className="msg-check">
            <input
              type="checkbox"
              checked={form.email}
              disabled={Boolean(alreadyEmailed)}
              onChange={(e) => update("email", e.target.checked)}
            />
            Also email it to them
          </label>

          {form.email && (
            <div className="msg-email-box">
              {alreadyEmailed ? (
                <p className="dashboard-hint">
                  Already emailed ({saved!.email_sent} of {saved!.email_total} sent). Changes you save now update the
                  bell only — nobody gets a second email.
                </p>
              ) : (
                <>
                  <div className="msg-field">
                    <label htmlFor="m-subject">Email subject</label>
                    <input
                      id="m-subject"
                      type="text"
                      value={form.email_subject}
                      placeholder={form.title || "Same as the title"}
                      onChange={(e) => update("email_subject", e.target.value)}
                    />
                  </div>
                  {reach && (
                    <p className="dashboard-hint">
                      Goes to <strong>{reach.emailable}</strong> of {reach.members}
                      {reach.unsubscribed > 0 &&
                        ` — ${reach.unsubscribed} ${reach.unsubscribed === 1 ? "has" : "have"} unsubscribed from member emails and will only see it in the bell`}
                      . Sent in small batches after you publish (about 600 an hour).
                    </p>
                  )}
                </>
              )}
              <div className="msg-test-row">
                <button type="button" className="button-pill button-pill-secondary" disabled={Boolean(busy) || !form.title || !form.audiences.length} onClick={onTest}>
                  {busy === "test" ? "Sending…" : "Send a test to me"}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="email-settings-done">{notice}</p>}

        <div className="msg-actions">
          <button type="button" className="button-pill" disabled={Boolean(busy)} onClick={() => onSave("publish")}>
            {busy === "publish" ? "Saving…" : saved?.status === "publish" ? "Save changes" : "Save & publish"}
          </button>
          {saved?.status !== "publish" && (
            <button type="button" className="button-pill button-pill-secondary" disabled={Boolean(busy)} onClick={() => onSave("draft")}>
              {busy === "draft" ? "Saving…" : "Save as draft"}
            </button>
          )}
          {saved?.status === "publish" && saved.state !== "ended" && (
            <button type="button" className="msg-end" disabled={Boolean(busy)} onClick={onEnd}>
              End message now
            </button>
          )}
        </div>
      </form>

      <aside className="msg-preview">
        <div className="msg-preview-label">Preview — in the bell</div>
        <div className="msg-preview-bell">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
          </div>
          <div className="notif-panel-body">
            <MessageCard message={previewMessage} onDismiss={() => undefined} />
          </div>
        </div>

        {form.email && (
          <>
            <div className="msg-preview-label">Preview — the email</div>
            <div className="msg-preview-email">
              <div className="msg-preview-email-meta">
                <div>
                  <strong>From:</strong> Secret Carshalton
                </div>
                <div>
                  <strong>Subject:</strong> {form.email_subject || form.title || "…"}
                </div>
              </div>
              <div className="msg-preview-email-head">Secret Carshalton</div>
              <div className="msg-preview-email-body">
                <p>Hi {yourName},</p>
                <h2>{form.title || "Your title"}</h2>
                {form.body
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} style={{ whiteSpace: "pre-line" }}>
                      {para}
                    </p>
                  ))}
                {form.button_text && form.button_url && <span className="notif-msg-button">{form.button_text} →</span>}
                <p>Rob, Secret Carshalton</p>
              </div>
              <div className="msg-preview-email-foot">
                You&apos;re getting this because {reason}.
                <br />
                <span className="msg-preview-link">Unsubscribe from member emails</span> ·{" "}
                <span className="msg-preview-link">Email settings</span>
                <br />
                Secret Carshalton{postal ? ` · ${postal}` : ""}
                {!postal && (
                  <span className="msg-preview-warn">
                    {" "}
                    — add your postal address on the <Link href="/admin/messages">Member messages</Link> page
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {saved?.status === "publish" && (
          <div className="dash-panel msg-preview-stats">
            <strong>So far</strong>
            <span>
              Seen by {saved.seen} of {saved.reach} · Dismissed by {saved.dismissed} · Button clicked {saved.clicked}{" "}
              {saved.clicked === 1 ? "time" : "times"}
            </span>
            {saved.email_status && (
              <span>
                Emailed {saved.email_sent} of {saved.email_total}
                {saved.email_failed ? ` · ${saved.email_failed} failed` : ""}
                {saved.email_status === "sending" ? " (still sending)" : ""}
              </span>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
