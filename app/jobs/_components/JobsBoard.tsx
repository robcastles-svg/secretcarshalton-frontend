"use client";

import Link from "next/link";
import { useState } from "react";

/** One job card's data, worked out on the server (app/jobs/page.tsx). */
export type JobCard = {
  id: number;
  slug: string;
  titleHtml: string;
  company: string;
  salary: string;
  date: string;
  dateLabel: string;
  featured: boolean;
  location: string;
  /** Straight-line miles from Carshalton; null when the location is vague or unknown. */
  miles: number | null;
  /** Pay as a yearly figure, for sorting; null when there's no pay given. */
  payPerYear: number | null;
};

type SortKey = "date" | "nearest" | "pay";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date", label: "By date" },
  { key: "nearest", label: "Nearest to Carshalton" },
  { key: "pay", label: "By pay" },
];

/** Jobs without the value being sorted on go to the end, newest first among themselves. */
function sorted(jobs: JobCard[], key: SortKey): JobCard[] {
  if (key === "date") return jobs;
  const value = (j: JobCard) => (key === "nearest" ? j.miles : j.payPerYear);
  const withValue = jobs.filter((j) => value(j) !== null);
  const without = jobs.filter((j) => value(j) === null);
  withValue.sort((a, b) => (key === "nearest" ? a.miles! - b.miles! : b.payPerYear! - a.payPerYear!));
  return [...withValue, ...without];
}

function JobRow({ job }: { job: JobCard }) {
  return (
    <li className={job.featured ? "job-card job-card-featured" : "job-card"}>
      <Link href={`/jobs/${job.slug}`} className="job-card-main">
        {job.featured && <span className="directory-badge">Featured</span>}
        <span className="card-title" dangerouslySetInnerHTML={{ __html: job.titleHtml }} />
        <div className="job-card-meta">
          {job.company && <span className="job-card-company">{job.company}</span>}
          {job.salary && <span className="job-card-salary">{job.salary}</span>}
        </div>
        {job.location && (
          <span className="job-card-location">
            {job.location}
            {job.miles !== null && ` · ${job.miles < 10 ? job.miles.toFixed(1) : Math.round(job.miles)} miles away`}
          </span>
        )}
        <time dateTime={job.date} className="job-card-date">
          {job.dateLabel}
        </time>
      </Link>
      <Link href={`/jobs/${job.slug}`} className="button-pill job-card-apply">
        View details
      </Link>
    </li>
  );
}

export function JobsSortBar({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  return (
    <div className="jobs-sort" role="group" aria-label="Sort jobs">
      {SORTS.map((s) => (
        <button
          key={s.key}
          type="button"
          className={value === s.key ? "button-pill button-pill-active" : "button-pill"}
          aria-pressed={value === s.key}
          onClick={() => onChange(s.key)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Both job sections with one shared sort bar above them. The cards arrive
 * newest first; sorting happens here in the browser so the page itself
 * stays a cached copy. A featured local job stays at the top of its list.
 */
export function JobsBoard({
  localJobs,
  apiJobs,
  disclaimer,
  emptyApi,
}: {
  localJobs: JobCard[];
  apiJobs: JobCard[];
  disclaimer: React.ReactNode;
  emptyApi: React.ReactNode;
}) {
  const [sort, setSort] = useState<SortKey>("date");
  const local = [...sorted(localJobs.filter((j) => j.featured), sort), ...sorted(localJobs.filter((j) => !j.featured), sort)];
  const api = sorted(apiJobs, sort);

  return (
    <>
      <JobsSortBar value={sort} onChange={setSort} />

      {local.length > 0 && (
        <section className="home-section">
          <div className="home-section-header">
            <h2>Posted locally</h2>
          </div>
          <ul className="job-list">
            {local.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}

      <section className="home-section">
        <div className="home-section-header">
          <h2>From around the area</h2>
        </div>
        {disclaimer}
        {api.length === 0 ? (
          emptyApi
        ) : (
          <ul className="job-list">
            {api.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
