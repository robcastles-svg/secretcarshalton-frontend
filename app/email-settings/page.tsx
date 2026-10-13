"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = { member_emails: boolean; email_hint: string };

/**
 * Where the "Unsubscribe" / "Email settings" links in member emails land.
 * The link carries a signed member id (u, t), so it works without
 * logging in. Unsubscribing takes a button press rather than happening
 * on page load: mail scanners open links in emails automatically, and
 * would otherwise unsubscribe people who never asked to be. (Mail apps'
 * own one-click unsubscribe goes straight to the plugin instead.)
 */
function EmailSettingsContent() {
  const params = useSearchParams();
  const u = params.get("u") ?? "";
  const t = params.get("t") ?? "";
  const query = `u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`;
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!u || !t) {
      setError("This link is missing some details — try the link in the email again.");
      return;
    }
    fetch(`/api/notify/email-unsubscribe?${query}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error);
        setStatus(d);
      })
      .catch((e: Error) => setError(e.message || "This link isn't valid."));
  }, [u, t, query]);

  const set = async (subscribe: boolean) => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/notify/email-unsubscribe?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribe }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error);
      setStatus((s) => (s ? { ...s, member_emails: d.member_emails } : s));
      setChanged(true);
    } catch (e) {
      setError((e as Error).message || "Couldn't save that — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container auth-page">
      <h1>Email settings</h1>
      {error && <p className="auth-error">{error}</p>}
      {!status && !error && <p>Loading…</p>}
      {status && (
        <>
          <p>
            For <strong>{status.email_hint}</strong>
          </p>
          {status.member_emails ? (
            <>
              <p>You get occasional emails from Secret Carshalton about new features, offers and what you&apos;ve posted.</p>
              {changed && <p className="email-settings-done">You&apos;re subscribed again — thanks.</p>}
              <button type="button" className="button-pill" disabled={saving} onClick={() => set(false)}>
                Unsubscribe from member emails
              </button>
            </>
          ) : (
            <>
              {changed ? (
                <p className="email-settings-done">Done — you won&apos;t get member emails from us any more.</p>
              ) : (
                <p>You&apos;re unsubscribed from member emails.</p>
              )}
              <p className="dashboard-hint">
                Messages still show in the notification bell when you&apos;re logged in, and emails about your account
                (receipts, approvals) still come through.
              </p>
              <button type="button" className="button-pill button-pill-secondary" disabled={saving} onClick={() => set(true)}>
                Subscribe again
              </button>
            </>
          )}
          <p style={{ marginTop: "1.5rem" }}>
            <Link href="/">Back to Secret Carshalton</Link>
          </p>
        </>
      )}
    </main>
  );
}

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<main className="container auth-page"><h1>Email settings</h1></main>}>
      <EmailSettingsContent />
    </Suspense>
  );
}
