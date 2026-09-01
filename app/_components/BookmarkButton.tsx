"use client";

import { useEffect, useState } from "react";
import { LoginModal } from "@/app/_components/LoginModal";

interface BookmarkState {
  count: number;
  bookmarked: boolean;
  logged_in: boolean;
}

/** Always visible on every card — logged out, a click opens the login popup rather than toggling anything. Mirrors the comment-count link's icon+number treatment, but the icon itself never hides. */
export function BookmarkButton({
  contentType,
  contentId,
}: {
  contentType: "post" | "listing";
  contentId: number;
}) {
  const [state, setState] = useState<BookmarkState | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookmarks/state?content_type=${contentType}&content_id=${contentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contentType, contentId]);

  async function handleClick() {
    if (pending) return;

    if (!state?.logged_in) {
      setShowLogin(true);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/bookmarks/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => (prev ? { ...prev, bookmarked: data.bookmarked, count: data.count } : prev));
      }
    } finally {
      setPending(false);
    }
  }

  const bookmarked = state?.bookmarked ?? false;
  const count = state?.count ?? 0;

  return (
    <>
      <button
        type="button"
        className={`card-bookmark-button${bookmarked ? " card-bookmark-button-active" : ""}`}
        onClick={handleClick}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={bookmarked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
        </svg>
        {count > 0 && count}
      </button>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
