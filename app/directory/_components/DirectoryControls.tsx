"use client";

import { useState } from "react";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Sort/search for the directory grid — a plain GET form so it works
 * without JS too (aside from the popup toggle and auto-submitting select,
 * both progressive enhancements). Sitewide search already exists in the
 * main nav; this is a second, section-scoped entry point for anyone who
 * doesn't notice/reach for that while already browsing the directory.
 */
export function DirectoryControls({
  category,
  q,
  sort,
}: {
  category: string;
  q: string;
  sort: string;
}) {
  const [searchOpen, setSearchOpen] = useState(Boolean(q));

  return (
    <form method="GET" action="/directory" className="directory-controls">
      {category && <input type="hidden" name="category" value={category} />}

      <div className="directory-search-popup-wrap">
        <button
          type="button"
          className="directory-search-icon"
          aria-label="Search listings"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <SearchIcon />
        </button>
        <div className="directory-search-popup" hidden={!searchOpen}>
          <input type="search" name="q" defaultValue={q} placeholder="Search listings…" />
          <button type="submit" className="button-pill">
            Go
          </button>
        </div>
      </div>

      <select
        name="sort"
        defaultValue={sort}
        aria-label="Sort listings"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="title">Title</option>
        <option value="random">Random</option>
        <option value="reviews">Most Reviews</option>
        <option value="rating">Highest Rated</option>
      </select>
    </form>
  );
}
