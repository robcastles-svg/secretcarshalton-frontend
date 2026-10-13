"use client";

import { useEffect, useRef, useState } from "react";

type Item = { slug: string; title: string };

/**
 * Rob's Spotlight article picker on the listing edit page (editors only):
 * search headlines, pick, reorder, remove, save. Same data as the
 * "Spotlight articles" box in wp-admin (sc_spotlight_slugs).
 */
export function SpotlightEditor({ listingId, initial }: { listingId: number; initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<Item & { date: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/admin/article-search?q=${encodeURIComponent(term)}`);
        setResults(r.ok ? await r.json() : []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [q]);

  const change = (next: Item[]) => {
    setItems(next);
    setDirty(true);
    setStatus(null);
  };

  const add = (item: Item) => {
    if (!items.some((i) => i.slug === item.slug)) change([...items, item]);
    setQ("");
    setResults([]);
  };

  const move = (i: number) => {
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    change(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/directory/${listingId}/spotlight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: items.map((i) => i.slug) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setStatus({ kind: "err", text: d.error || "Couldn't save." });
      else {
        setDirty(false);
        setStatus({ kind: "ok", text: "Saved — the listing page is updated." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="directory-gallery-manager spotlight-editor" id="spotlight">
      <h2>Spotlight articles</h2>
      <p className="auth-hint">Only you can see this. Articles about this business, shown on its listing page in this order.</p>

      {items.length === 0 ? (
        <p className="auth-hint">None linked yet.</p>
      ) : (
        <ol className="spotlight-editor-list">
          {items.map((item, i) => (
            <li key={item.slug}>
              <span>{item.title}</span>
              {i > 0 && (
                <button type="button" onClick={() => move(i)}>
                  ↑ Up
                </button>
              )}
              <button type="button" onClick={() => change(items.filter((x) => x.slug !== item.slug))}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="spotlight-editor-search">
        <label htmlFor="spotlight-search" className="dash-sr-only">
          Search articles
        </label>
        <input
          id="spotlight-search"
          type="search"
          value={q}
          placeholder="Search articles by headline…"
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
        />
        {(results.length > 0 || (searching && q.trim().length >= 3)) && (
          <ul className="spotlight-editor-results">
            {searching && results.length === 0 && <li className="spotlight-editor-note">Searching…</li>}
            {results.map((r) => (
              <li key={r.slug}>
                <button type="button" onClick={() => add(r)}>
                  {r.title}
                  <span>{r.date.slice(0, 10)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="spotlight-editor-actions">
        <button type="button" className="button-pill" disabled={saving || !dirty} onClick={save}>
          {saving ? "Saving…" : "Save spotlight articles"}
        </button>
        {status && <span className={status.kind === "ok" ? "spotlight-editor-ok" : "auth-error"}>{status.text}</span>}
      </div>
    </div>
  );
}
