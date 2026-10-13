"use client";

import { useEffect, useState } from "react";

/**
 * The member's own switch for messages from Secret Carshalton by email.
 * Off stops those emails only: account emails (receipts, approvals,
 * replies) carry on, and messages still show in the bell.
 */
export function EmailSettings() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/notify/email-preferences")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { member_emails: boolean }) => setOn(d.member_emails))
      .catch(() => setError("Couldn't load your email settings."));
  }, []);

  const change = async (next: boolean) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/notify/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_emails: next }),
      });
      if (!res.ok) throw new Error();
      setOn(next);
    } catch {
      setError("Couldn't save that — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dash-panel" id="email-settings">
      <h2 className="dash-h3">Email settings</h2>
      <label className="email-settings-toggle">
        <input
          type="checkbox"
          checked={on ?? false}
          disabled={on === null || saving}
          onChange={(e) => change(e.target.checked)}
        />
        <span>
          <strong>Messages from Secret Carshalton</strong>
          <span className="dashboard-hint">
            Occasional news for members — new features, offers and updates about what you&apos;ve posted. They also
            show in your notification bell.
          </span>
        </span>
      </label>
      <p className="dashboard-hint">
        Emails about your account — payment receipts, approvals and replies to your comments — are always sent.
      </p>
      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}
