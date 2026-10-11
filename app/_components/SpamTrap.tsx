"use client";

import { useEffect, useRef } from "react";

/**
 * Light spam protection for public forms, with nothing for real visitors
 * to do: a "website" field hidden off-screen that only bots fill in, and
 * how long the form was open (timed in the visitor's own browser, so a
 * wrong clock can't block anyone). Checked server-side by looksLikeSpam
 * in lib/spam.ts. Cloudflare Turnstile is the next step if spam still
 * gets through (Rob's call: only after launch, if it becomes a problem).
 *
 * Put <SpamTrap /> inside the <form>; FormData-based forms then send both
 * fields automatically, and JSON forms add spamFields(form) to their body.
 */
export function SpamTrap() {
  const openedAt = useRef(0);
  const elapsed = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openedAt.current = Date.now();
    const form = elapsed.current?.form;
    // Filled in at submit time, before the form's own onSubmit reads it.
    const update = () => {
      if (elapsed.current) elapsed.current.value = String(Date.now() - openedAt.current);
    };
    form?.addEventListener("submit", update, { capture: true });
    return () => form?.removeEventListener("submit", update, { capture: true });
  }, []);

  return (
    <div className="spam-trap" aria-hidden="true">
      <label>
        Leave this empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
      <input type="hidden" name="form_ms" ref={elapsed} defaultValue="" />
    </div>
  );
}

/** The two trap fields from a form, for forms that post JSON. */
export function spamFields(form: HTMLFormElement): { website: string; form_ms: string } {
  const data = new FormData(form);
  return { website: String(data.get("website") ?? ""), form_ms: String(data.get("form_ms") ?? "") };
}
