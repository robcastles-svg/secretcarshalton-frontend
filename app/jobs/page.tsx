import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getJobListings, getJobLocations } from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Jobs Board — Secret Carshalton" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;

  // Staging (which this reads from — see lib/wordpress.ts's WP_STAGING_ROOT
  // note) has proven unreliable to reach from Vercel's runtime; never let
  // that hang or crash this page — an empty board is recoverable, a dead
  // page isn't.
  const [jobs, locations] = await Promise.all([
    getJobListings().catch(() => []),
    getJobLocations().catch(() => []),
  ]);

  const activeLocation = location ? locations.find((l) => l.slug === location) : null;
  const filteredJobs = activeLocation ? jobs.filter((j) => j.job_location.includes(activeLocation.id)) : jobs;

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Jobs Board
            <CategoryKeyIcon />
          </h1>
          <p>Local vacancies from around Carshalton, Sutton and the surrounding area, updated daily.</p>
        </div>
      </div>

      {locations.length > 0 && (
        <nav className="directory-category-nav">
          <Link href="/jobs" className={!activeLocation ? "active" : undefined}>
            All areas
          </Link>
          {locations.map((l) => (
            <Link
              key={l.id}
              href={`/jobs?location=${l.slug}`}
              className={activeLocation?.slug === l.slug ? "active" : undefined}
            >
              {l.name} ({l.count})
            </Link>
          ))}
        </nav>
      )}

      {filteredJobs.length === 0 ? (
        <p className="directory-empty">
          No jobs listed yet — check back soon, this board updates automatically every day.
        </p>
      ) : (
        <ul className="job-list">
          {filteredJobs.map((job) => (
            <li key={job.id} className="job-card">
              <div className="job-card-main">
                <span className="card-title" dangerouslySetInnerHTML={{ __html: job.title.rendered }} />
                <div className="job-card-meta">
                  {job.meta.job_company && <span>{job.meta.job_company}</span>}
                  {job.meta.job_salary_text && <span>{job.meta.job_salary_text}</span>}
                  <time dateTime={job.date}>Posted {formatDate(job.date)}</time>
                </div>
              </div>
              {job.meta.external_url && (
                <a
                  href={job.meta.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-pill job-card-apply"
                >
                  View &amp; apply
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
