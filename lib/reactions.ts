"use client";

/**
 * Likes and share counts for articles, browser side (see SC_Post_Reactions
 * in sc-post-views). Every ReactionBar on a page asks for its article's
 * numbers here; the requests made in the same moment are sent as one
 * (a page of 20 cards is one call, not 20).
 */

export interface Reaction {
  likes: number;
  shares: number;
  liked: boolean;
}

type Listener = (r: Reaction) => void;

const cache = new Map<string, Reaction>();
const listeners = new Map<string, Set<Listener>>();
let queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** A random ID this browser keeps, so a visitor's like is remembered without an account. */
export function visitorId(): string {
  try {
    let id = localStorage.getItem("sc_visitor");
    if (!id || !/^[a-z0-9-]{16,64}$/.test(id)) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).toLowerCase();
      localStorage.setItem("sc_visitor", id);
    }
    return id;
  } catch {
    return "";
  }
}

function emit(slug: string, r: Reaction) {
  cache.set(slug, r);
  listeners.get(slug)?.forEach((fn) => fn(r));
}

async function flush() {
  timer = null;
  const slugs = [...queued];
  queued = new Set();
  const visitor = visitorId();
  for (let i = 0; i < slugs.length; i += 60) {
    const chunk = slugs.slice(i, i + 60);
    try {
      const res = await fetch(`/api/reactions?slugs=${encodeURIComponent(chunk.join(","))}&visitor=${encodeURIComponent(visitor)}`);
      if (!res.ok) continue;
      const data: Record<string, Reaction> = await res.json();
      for (const slug of chunk) if (data[slug]) emit(slug, data[slug]);
    } catch {
      // Counts just stay hidden; the buttons still work.
    }
  }
}

/** Calls back with this article's numbers now (if known) and whenever they change. Returns an unsubscribe. */
export function subscribe(slug: string, fn: Listener): () => void {
  if (!listeners.has(slug)) listeners.set(slug, new Set());
  listeners.get(slug)!.add(fn);
  const known = cache.get(slug);
  if (known) fn(known);
  else {
    queued.add(slug);
    if (!timer) timer = setTimeout(flush, 0);
  }
  return () => listeners.get(slug)?.delete(fn);
}

export async function setLiked(slug: string, liked: boolean) {
  const before = cache.get(slug) ?? { likes: 0, shares: 0, liked: false };
  if (before.liked === liked) return;
  // Show it straight away; correct it from the server's answer.
  emit(slug, { ...before, liked, likes: Math.max(0, before.likes + (liked ? 1 : -1)) });
  try {
    const res = await fetch("/api/reactions/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, liked, visitor: visitorId() }),
    });
    if (!res.ok) throw new Error();
    const data: { likes: number; liked: boolean } = await res.json();
    emit(slug, { ...(cache.get(slug) ?? before), likes: data.likes, liked: data.liked });
  } catch {
    emit(slug, before);
  }
}

export async function countShare(slug: string) {
  const before = cache.get(slug) ?? { likes: 0, shares: 0, liked: false };
  emit(slug, { ...before, shares: before.shares + 1 });
  try {
    const res = await fetch("/api/reactions/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) throw new Error();
    const data: { shares: number } = await res.json();
    emit(slug, { ...(cache.get(slug) ?? before), shares: data.shares });
  } catch {
    emit(slug, before);
  }
}
