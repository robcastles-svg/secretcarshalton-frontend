import Link from "next/link";

export const metadata = { title: "Page not found — Secret Carshalton" };

/**
 * Any address the site doesn't serve. Old WordPress addresses that moved
 * are redirected before reaching here (lib/legacy-redirects.mjs), so this
 * is mostly removed articles and mistyped links — point people at search
 * and the main sections rather than a dead end.
 */
export default function NotFound() {
  return (
    <main className="container not-found-page">
      <h1>Sorry, we can&apos;t find that page</h1>
      <p>It may have moved, or the link might be mistyped. Try searching for it:</p>
      <form action="/search" className="not-found-search">
        <input type="search" name="s" placeholder="Search stories, walks, events…" aria-label="Search" />
        <button type="submit" className="button-pill">
          Search
        </button>
      </form>
      <p>Or head to one of these:</p>
      <ul className="not-found-links">
        <li><Link href="/">Home</Link></li>
        <li><Link href="/news">News</Link></li>
        <li><Link href="/events">What&apos;s on</Link></li>
        <li><Link href="/discover">Discover</Link></li>
        <li><Link href="/walks">Walks</Link></li>
        <li><Link href="/directory">Directory</Link></li>
      </ul>
    </main>
  );
}
