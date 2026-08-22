import { ContentList } from "@/app/_components/ContentList";
import { searchPosts } from "@/lib/wordpress";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = q ? await searchPosts(q).catch(() => []) : [];

  return (
    <main className="container">
      <h1>Search</h1>
      <form action="/search" style={{ marginBottom: "1.5rem" }}>
        <input type="search" name="q" defaultValue={q} placeholder="Search stories and walks" />
        <button type="submit">Search</button>
      </form>
      {q && results.length === 0 && <p>No results for &quot;{q}&quot;.</p>}
      <ContentList items={results} />
    </main>
  );
}
