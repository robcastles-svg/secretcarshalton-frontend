"use client";

import { useState } from "react";

/** The "Update these details" request: one short question, then sent to Rob for approval. */
export function OrganizerClaimForm({ organizerId }: { organizerId: number }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <p className="evx-claim-sent">
        Thanks — your request has been sent. We&apos;ll check it and email you once you can manage this group.
      </p>
    );
  }
  if (!open) {
    return (
      <>
        <p>Keep these details up to date, add a logo and manage your events.</p>
        <button type="button" className="evx-btn-dark" onClick={() => setOpen(true)}>
          Update these details
        </button>
      </>
    );
  }
  return (
    <form
      className="evx-claim-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError(null);
        const res = await fetch(`/api/events/organizers/${organizerId}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) setState("sent");
        else {
          setError(body.error || "Sorry, that didn't work. Please try again.");
          setState("idle");
        }
      }}
    >
      <label htmlFor="claim-msg">How are you connected with this group?</label>
      <textarea
        id="claim-msg"
        rows={3}
        maxLength={500}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. I'm the secretary and look after our events"
        required
      />
      {error && <p className="evx-claim-error">{error}</p>}
      <button type="submit" className="evx-btn-dark" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
