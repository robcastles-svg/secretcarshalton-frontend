"use client";

import { useState } from "react";
import { SITE_URL } from "@/lib/event-view";
import { FacebookIcon, LinkIcon, MailIcon, XIcon } from "../../_components/EvIcons";

/**
 * The round share icons beside "Add to calendar" / "I'm interested".
 * The URL is always built from the site URL, never window.location: the
 * server-rendered HTML has no window, so the old fallback shipped
 * domain-less share links ("/events/…") until hydration — what crawlers
 * and no-JS visitors saw. Same value on server and client also means no
 * hydration mismatch.
 */
export function ShareEventRow({ path, title }: { path: string; title: string }) {
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
    <div className="evx-share" aria-label="Share this event">
      <a
        className="evx-icon-btn"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
      >
        <FacebookIcon />
      </a>
      <a
        className="evx-icon-btn"
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
      >
        <XIcon />
      </a>
      <a
        className="evx-icon-btn"
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
        aria-label="Share by email"
      >
        <MailIcon />
      </a>
      <button type="button" className="evx-icon-btn" onClick={handleCopy} aria-label={copied ? "Link copied" : "Copy link"}>
        <LinkIcon />
      </button>
      {copied && (
        <span className="evx-share-copied" role="status">
          Link copied
        </span>
      )}
    </div>
  );
}
