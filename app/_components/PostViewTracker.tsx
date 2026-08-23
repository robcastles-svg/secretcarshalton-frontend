"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible — fires once when a real browser renders the post, not on
 * every SSR/ISR regeneration or crawler request (which never run this
 * client component at all). Mirrors the third-party Post Views Counter
 * plugin's own approach for the same reason: counting server-side would
 * also count bots and background page-regeneration passes.
 */
export function PostViewTracker({ postId, slug, title }: { postId: number; slug: string; title: string }) {
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (firedFor.current === postId) return;
    firedFor.current = postId;
    fetch("/api/post-views/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, slug, title }),
    }).catch(() => {});
  }, [postId, slug, title]);

  return null;
}
