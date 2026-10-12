"use client";

import { useState } from "react";
import { SpamTrap, spamFields } from "@/app/_components/SpamTrap";

/** The contact form — sends through /api/contact to info@ (see SC_Membership_Contact). */
export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        subject: data.get("subject"),
        message: data.get("message"),
        ...spamFields(form),
      }),
    }).catch(() => null);
    setSubmitting(false);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error || "Sorry, your message couldn't be sent. Please email us at info@secretcarshalton.com.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="contact-sent" role="status">
        Thanks — your message has been sent. We&apos;ll get back to you as soon as we can.
      </p>
    );
  }

  return (
    <form className="auth-form contact-form" onSubmit={handleSubmit}>
      <SpamTrap />
      <label>
        Your name
        <input type="text" name="name" required maxLength={200} autoComplete="name" />
      </label>
      <label>
        Your email
        <input type="email" name="email" required maxLength={200} autoComplete="email" />
      </label>
      <label>
        Subject
        <input type="text" name="subject" maxLength={200} />
      </label>
      <label>
        Message
        <textarea name="message" rows={8} required maxLength={5000} />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
