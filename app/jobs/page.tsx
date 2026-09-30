import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getJobListings, type WPJobListing } from "@/lib/wordpress";

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

function JobRow({ job }: { job: WPJobListing }) {
  return (
    <li className="job-card">
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
  );
}

export default async function JobsPage() {
  const allJobs = await getJobListings().catch(() => []);

  // Reed-synced ("api") and member-submitted ("member") listings are kept
  // in two separate sections rather than merged into one board — Rob's
  // call, since the external-sources disclaimer below only applies to one
  // of them and mixing the two would blur that distinction.
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const apiJobs = allJobs.filter((j) => j.meta.source !== "member" && new Date(j.date).getTime() >= cutoff);
  const memberJobs = allJobs.filter((j) => j.meta.source === "member");

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Jobs Board
            <CategoryKeyIcon />
          </h1>
          <p>Local vacancies from around Carshalton, Sutton and the surrounding area.</p>
        </div>
        <Link href="/jobs/submit" className="button-pill">
          Add a job
        </Link>
      </div>

      {memberJobs.length > 0 && (
        <section className="home-section">
          <div className="home-section-header">
            <h2>Posted locally</h2>
          </div>
          <ul className="job-list">
            {memberJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}

      <section className="home-section">
        <div className="home-section-header">
          <h2>From around the area</h2>
        </div>
        <p className="job-external-disclaimer">
          These listings are pulled in automatically from external job sites (via the Reed API), posted in the
          last 7 days — Secret Carshalton doesn&apos;t manage or vet them. Click a job to read the details here,
          then apply on the original site.
        </p>

        {apiJobs.length === 0 ? (
          <p className="directory-empty">
            No jobs posted in the last 7 days — check back soon, this board updates automatically every day.
          </p>
        ) : (
          <ul className="job-list">
            {apiJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
