import Link from "next/link";
import { getTags, searchSite } from "@/lib/wordpress";

export const metadata = { title: "Search" };

const CATEGORY_TABS: Array<{ slug: string; label: string }> = [
  { slug: "", label: "All" },
  { slug: "news", label: "News" },
  { slug: "stories", label: "Stories" },
  { slug: "walks", label: "Walks" },
  { slug: "events", label: "Events" },
  { slug: "directory", label: "Directory" },
];

const RESULT_TYPE_LABEL: Record<string, string> = {
  post: "Article",
  event: "Event",
  listing: "Directory",
};

function buildFilterHref(
  current: { s: string; search_mode: string; tag: string; sort: string },
  overrides: Record<string, string>
) {
  const merged: Record<string, string> = { ...current, ...overrides };
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `/search?${qs}` : "/search";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; cat?: string; search_mode?: string; tag?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = params.s?.trim() || "";
  const category = params.cat || "";
  const searchMode = params.search_mode || "both";
  const tag = params.tag || "";
  const sort = params.sort || "";

  const [allTags, results] = await Promise.all([
    getTags().catch(() => []),
    q ? searchSite({ q, category, searchMode, tag, sort }).catch(() => []) : Promise.resolve([]),
  ]);

  const tabQuery = { s: q, search_mode: searchMode, tag, sort };

  return (
    <main className="container search-page">
      <h1>Search Secret Carshalton</h1>
      <p className="search-subtitle">Use the filters below to find content.</p>

      <div className="category-filter-bar">
        {CATEGORY_TABS.map((tab) => (
          <Link
            key={tab.slug || "all"}
            href={buildFilterHref(tabQuery, { cat: tab.slug })}
            className={category === tab.slug ? "active" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form method="GET" action="/search" className="search-filter-form">
        <input type="search" name="s" defaultValue={q} placeholder="Search..." />
        {category && <input type="hidden" name="cat" value={category} />}
        <select name="search_mode" defaultValue={searchMode}>
          <option value="both">Title + Content</option>
          <option value="title">Title only</option>
          <option value="content">Content only</option>
        </select>
        <select name="tag" defaultValue={tag}>
          <option value="">All Themes</option>
          {allTags
            .filter((t) => t.count === undefined || t.count > 0)
            .map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
        </select>
        <select name="sort" defaultValue={sort}>
          <option value="">Sort By</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
        <button type="submit" className="button-pill">
          Apply
        </button>
      </form>

      {!q ? (
        <p className="search-prompt">Enter a search term above to get started.</p>
      ) : results.length === 0 ? (
        <p className="search-nothing-found">It seems we can&rsquo;t find what you&rsquo;re looking for.</p>
      ) : (
        <ul className="post-list search-results-list">
          {results.map((item) => {
            const date = formatDate(item.date);
            return (
              <li key={`${item.type}-${item.id}`}>
                <Link href={item.href}>
                  {item.image && <img src={item.image.source_url} alt={item.image.alt_text} loading="lazy" />}
                  <div className="card-text">
                    <span className="card-tag">{RESULT_TYPE_LABEL[item.type]}</span>
                    <span className="card-title">{item.title}</span>
                    {item.meta && <span className="card-category">{item.meta}</span>}
                  </div>
                </Link>
                {date && <time dateTime={item.date}>{date}</time>}
                <p>{item.excerpt}</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
