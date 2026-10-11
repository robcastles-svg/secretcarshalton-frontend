"use client";

import { useState } from "react";
import { SITE_URL } from "@/lib/event-view";
import { FacebookIcon, LinkIcon, MailIcon, XIcon } from "@/app/events/_components/EvIcons";

/**
 * Round share icons (Facebook, X, email, copy link) — beside "Add to
 * calendar" / "I'm interested" on events (the default evx classes), and
 * on articles with the "share-row" classes.
 * The URL is always built from the site URL, never window.location: the
 * server-rendered HTML has no window, so the old fallback shipped
 * domain-less share links ("/events/…") until hydration — what crawlers
 * and no-JS visitors saw. Same value on server and client also means no
 * hydration mismatch.
 */
export function ShareRow({
  path,
  title,
  label = "Share this event",
  variant = "evx",
}: {
  path: string;
  title: string;
  label?: string;
  /** "evx" inside the events design; "share-row" anywhere else. */
  variant?: "evx" | "share-row";
}) {
  const box = variant === "evx" ? "evx-share" : "share-row";
  const btn = variant === "evx" ? "evx-icon-btn" : "share-row-btn";
  const [copied, setCopied] = useState(false);
  const url = SITE_URL + path;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browsers, non-HTTPS) — not worth erroring over.
    }
  }

  return (
    <div className={box} aria-label={label}>
      <a
        className={btn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
      >
        <FacebookIcon />
      </a>
      <a
        className={btn}
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
      >
        <XIcon />
      </a>
      <a
        className={btn}
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
        aria-label="Share by email"
      >
        <MailIcon />
      </a>
      <button type="button" className={btn} onClick={handleCopy} aria-label={copied ? "Link copied" : "Copy link"}>
        <LinkIcon />
      </button>
      {copied && (
        <span className={`${box}-copied`} role="status">
          Link copied
        </span>
      )}
    </div>
  );
}
