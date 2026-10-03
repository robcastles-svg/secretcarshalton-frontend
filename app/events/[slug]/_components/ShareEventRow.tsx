"use client";

import { useState } from "react";

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.5c0-.87.24-1.46 1.5-1.46H16V4.35C15.72 4.32 14.76 4.24 13.65 4.24c-2.32 0-3.9 1.42-3.9 4.02V10.5H7.25v3H9.75V21h3.75Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4l7.2 9.2L4.3 20h2.1l5.8-5.8L16.9 20H20l-7.5-9.6L19.6 4h-2.1l-5.4 5.4L8 4H4Z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

/**
 * Matches EventON's "Share this event" row — Facebook/X/email are plain
 * links (no JS needed), copy-link is the one bit of real interactivity,
 * hence this being a client component. `path` rather than a full URL
 * because the page itself doesn't know (or need to know) its own public
 * origin — window.location.origin is always correct for wherever this is
 * actually being viewed (preview deploy, production, etc).
 */
export function ShareEventRow({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin + path : path;

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
    <div className="share-event-row">
      <span className="event-meta-label">Share this event</span>
      <div className="share-event-icons">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Facebook"
        >
          <FacebookIcon />
        </a>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
        >
          <XIcon />
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`} aria-label="Share by email">
          <EmailIcon />
        </a>
        <button type="button" onClick={handleCopy} aria-label="Copy link">
          <CopyIcon />
        </button>
      </div>
      {copied && <span className="share-event-copied">Link copied</span>}
    </div>
  );
}
