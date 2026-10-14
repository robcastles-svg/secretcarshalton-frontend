"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookmarkButton } from "@/app/_components/BookmarkButton";
import { ShareRow } from "@/app/_components/ShareRow";
import {
  countShare,
  setLiked,
  subscribe,
  type Reaction,
} from "@/lib/reactions";

/**
 * 👍 like · 💬 comments · ↗ share · bookmark at the top of each article,
 * beside the view count; cards show just 💬 comments and the bookmark
 * (Rob, 2026-10). Numbers only show once there's something to count;
 * nothing is made up.
 *
 * - Like: anyone can tap it; tapping again takes it back.
 * - Comments: jumps to the article's comments.
 * - Share: opens a small pop-up with the share icons (and the phone's own
 *   share menu where there is one). Each open counts as a share.
 */
export function ReactionBar({
  slug,
  title,
  commentCount,
  bookmarkId,
  variant = "card",
}: {
  slug: string;
  title: string;
  commentCount: number;
  /** The article's id for the bookmark button; omitted to leave the bookmark out. */
  bookmarkId?: number;
  variant?: "card" | "article";
}) {
  const [r, setR] = useState<Reaction | null>(null);
  const [open, setOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const full = variant === "article";
  // Cards don't show likes or shares, so they don't ask for them.
  useEffect(() => (full ? subscribe(slug, setR) : undefined), [slug, full]);
  useEffect(
    () =>
      setCanNativeShare(
        typeof navigator !== "undefined" &&
          typeof navigator.share === "function",
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const likes = r?.likes ?? 0;
  const shares = r?.shares ?? 0;
  const liked = r?.liked ?? false;

  function openShare() {
    if (!open) countShare(slug);
    setOpen(!open);
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title,
        url: `${window.location.origin}/${slug}`,
      });
      setOpen(false);
    } catch {
      // Cancelled — leave the pop-up open.
    }
  }

  return (
    <div className={`reactions reactions-${variant}`} ref={wrapRef}>
      {full && (
        <button
          type="button"
          className={liked ? "reaction reaction-liked" : "reaction"}
          aria-pressed={liked}
          aria-label={
            liked
              ? `Liked (${likes}) — tap to unlike`
              : `Like${likes ? ` (${likes})` : ""}`
          }
          onClick={() => setLiked(slug, !liked)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 10v11" />
            <path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9Z" />
          </svg>
          {likes > 0 && <span>{likes}</span>}
        </button>
      )}

      <Link
        href={variant === "article" ? "#comments" : `/${slug}#comments`}
        className="reaction"
        aria-label={
          commentCount
            ? `${commentCount} comment${commentCount === 1 ? "" : "s"}`
            : "Comments"
        }
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        {commentCount > 0 && <span>{commentCount}</span>}
      </Link>

      {full && (
        <div className="reaction-share-wrap">
          <button
            type="button"
            className={open ? "reaction reaction-open" : "reaction"}
            aria-expanded={open}
            aria-label={`Share${shares ? ` (${shares} shares)` : ""}`}
            onClick={openShare}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4.5 21 11l-7 6.5V14c-5.5 0-9 1.6-11.5 5.5C3.5 13.6 7 9.6 14 8.6Z" />
            </svg>
            {shares > 0 && <span>{shares}</span>}
          </button>
          {open && (
            <div
              className="reaction-share-pop"
              role="dialog"
              aria-label="Share this story"
            >
              <ShareRow
                path={`/${slug}`}
                title={title}
                label="Share this story"
                variant="share-row"
              />
              {canNativeShare && (
                <button
                  type="button"
                  className="reaction-share-more"
                  onClick={nativeShare}
                >
                  More options…
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {bookmarkId !== undefined && (
        <span className="reaction-bookmark">
          <BookmarkButton contentType="post" contentId={bookmarkId} />
        </span>
      )}
    </div>
  );
}
