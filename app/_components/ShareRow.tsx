"use client";

import { useState } from "react";
import { SITE_URL } from "@/lib/event-view";
import { FacebookIcon, InstagramIcon, LinkIcon, MailIcon, XIcon } from "@/app/events/_components/EvIcons";

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
  storyImage,
}: {
  path: string;
  title: string;
  label?: string;
  /** "evx" inside the events design; "share-row" anywhere else. */
  variant?: "evx" | "share-row";
  /** An Instagram Story picture for this page (events: /events/{slug}/story.png) — adds the Instagram button. */
  storyImage?: string;
}) {
  const box = variant === "evx" ? "evx-share" : "share-row";
  const btn = variant === "evx" ? "evx-icon-btn" : "share-row-btn";
  const [copied, setCopied] = useState(false);
  const [storyNote, setStoryNote] = useState<string | null>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
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

  function flash(note: string) {
    setStoryNote(note);
    setTimeout(() => setStoryNote(null), 3000);
  }

  /**
   * Phones: the share sheet with the Story picture attached — pick
   * Instagram, then "Your story", and add a link sticker. Elsewhere (no
   * file sharing, e.g. desktop): the picture downloads instead. The
   * picture is fetched on the first tap; iPhones only allow the share
   * sheet straight from a tap, so if fetching took too long the button
   * asks for a second tap, which shares the picture it already has.
   */
  async function handleStory() {
    if (!storyImage || storyBusy) return;
    let file = storyFile;
    if (!file) {
      setStoryBusy(true);
      try {
        const res = await fetch(storyImage);
        if (!res.ok) throw new Error(String(res.status));
        const name = `${path.split("/").filter(Boolean).pop() ?? "secret-carshalton"}-instagram-story.png`;
        file = new File([await res.blob()], name, { type: "image/png" });
        setStoryFile(file);
      } catch {
        flash("Couldn't make the picture — try again");
        return;
      } finally {
        setStoryBusy(false);
      }
    }
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (err) {
        if ((err as DOMException).name === "NotAllowedError") flash("Ready — tap again to share");
      }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    flash("Story picture downloaded");
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
      {storyImage && (
        <button
          type="button"
          className={btn}
          onClick={handleStory}
          aria-label="Share to your Instagram Story"
          title="Instagram Story"
          aria-busy={storyBusy}
        >
          <InstagramIcon />
        </button>
      )}
      <button type="button" className={btn} onClick={handleCopy} aria-label={copied ? "Link copied" : "Copy link"}>
        <LinkIcon />
      </button>
      {(copied || storyNote) && (
        <span className={`${box}-copied`} role="status">
          {copied ? "Link copied" : storyNote}
        </span>
      )}
    </div>
  );
}
