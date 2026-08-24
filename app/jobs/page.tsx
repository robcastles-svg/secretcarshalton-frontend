import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getJobListings } from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Jobs Board — Secret Carshalton" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function JobsPage() {
  // Staging (which this reads from — see lib/wordpress.ts's WP_STAGING_ROOT
  // note) has proven unreliable to reach from Vercel's runtime; never let
  // that hang or crash this page — an empty board is recoverable, a dead
  // page isn't.
  const jobs = await getJobListings().catch(() => []);

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

      <p className="job-external-disclaimer">
        These listings are pulled in automatically from external job sites (via the Reed API) — Secret
        Carshalton doesn&apos;t manage or vet them. Click a job to read the details here, then apply on the
        original site.
      </p>

      {jobs.length === 0 ? (
        <p className="directory-empty">
          No jobs listed yet — check back soon, this board updates automatically every day.
        </p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id} className="job-card">
              <Link href={`/jobs/${job.slug}`} className="job-card-main">
                <span className="card-title" dangerouslySetInnerHTML={{ __html: job.title.rendered }} />
                <div className="job-card-meta">
                  {job.meta.job_company && <span>{job.meta.job_company}</span>}
                  {job.meta.job_salary_text && <span>{job.meta.job_salary_text}</span>}
                  <time dateTime={job.date}>Posted {formatDate(job.date)}</time>
                </div>
              </Link>
              <Link href={`/jobs/${job.slug}`} className="button-pill job-card-apply">
                View details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
