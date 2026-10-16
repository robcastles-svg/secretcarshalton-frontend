"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Your public name": what shows on comments, the members list and their profile (their username and profile address don't change). */
export function DisplayNameForm({ current }: { current: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/auth/display-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMessage({ ok: false, text: data.error || "Couldn't save — please try again." });
    setName(data.display_name);
    setEditing(false);
    setMessage({ ok: true, text: "Saved." });
    router.refresh();
  }

  if (!editing) {
    return (
      <p className="display-name-row">
        Your public name: <b>{name}</b>{" "}
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          Change
        </button>
        {message?.ok && <span className="display-name-saved"> {message.text}</span>}
      </p>
    );
  }

  return (
    <form className="display-name-form" onSubmit={save}>
      <label>
        Your public name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoFocus />
      </label>
      <small>Shown on your comments, reviews and profile. Your login username stays the same.</small>
      {message && !message.ok && <p className="auth-error">{message.text}</p>}
      <div className="display-name-actions">
        <button type="submit" className="button-pill" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="button-pill button-pill-secondary"
          onClick={() => {
            setName(current);
            setEditing(false);
            setMessage(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
