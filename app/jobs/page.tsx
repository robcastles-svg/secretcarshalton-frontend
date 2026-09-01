import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getJobListings } from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Jobs Board — Secret Carshalton" };

const RECENT_WINDOW_DAYS = 7;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function daysAgoLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default async function JobsPage() {
  // Staging (which this reads from — see lib/wordpress.ts's WP_STAGING_ROOT
  // note) has proven unreliable to reach from Vercel's runtime; never let
  // that hang or crash this page — an empty board is recoverable, a dead
  // page isn't.
  const allJobs = await getJobListings().catch(() => []);

  // getJobListings() already sorts newest-first, and a job's `date` is now
  // the real Reed posting date (see SC_Jobs_Sync::upsert_reed_job), not
  // whenever our own cron happened to sync it — so this genuinely reflects
  // "posted in the last week," not "synced in the last week."
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const jobs = allJobs.filter((j) => new Date(j.date).getTime() >= cutoff);

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Jobs Board
            <CategoryKeyIcon />
          </h1>
          <p>Local vacancies from around Carshalton, Sutton and the surrounding area, posted in the last 7 days.</p>
        </div>
        {/* Placeholder until member job submissions (Phase 2 of the original
            brief) are built — not a real link yet, just holding the spot
            in the header row. */}
        <span className="button-pill button-pill-disabled" aria-disabled="true">
          Add a job — coming soon
        </span>
      </div>

      <p className="job-external-disclaimer">
        These listings are pulled in automatically from external job sites (via the Reed API) — Secret
        Carshalton doesn&apos;t manage or vet them. Click a job to read the details here, then apply on the
        original site.
      </p>

      {jobs.length === 0 ? (
        <p className="directory-empty">
          No jobs posted in the last 7 days — check back soon, this board updates automatically every day.
        </p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id} className="job-card">
              <Link href={`/jobs/${job.slug}`} className="job-card-main">
                <span className="card-title" dangerouslySetInnerHTML={{ __html: job.title.rendered }} />
                <div className="job-card-meta">
                  {job.meta.job_company && <span className="job-card-company">{job.meta.job_company}</span>}
                  {job.meta.job_salary_text && <span className="job-card-salary">{job.meta.job_salary_text}</span>}
                </div>
                <time dateTime={job.date} className="job-card-date">
                  {daysAgoLabel(job.date)} &middot; {formatDate(job.date)}
                </time>
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
