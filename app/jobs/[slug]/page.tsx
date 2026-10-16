import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobListingBySlug, stripHtml, soft } from "@/lib/wordpress";
import { EditInWordPress } from "@/app/_components/EditInWordPress";

export const revalidate = 3600;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function daysAgoLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobListingBySlug(slug).catch(soft(null));
  if (!job) return {};
  return {
    title: `${stripHtml(job.title.rendered)} — The Sutton Jobs Board — Secret Carshalton`,
    description: stripHtml(job.content.rendered).slice(0, 160),
    // Reed jobs repeat Reed's own advert word for word and only last a few
    // weeks, so keep them out of search results (Rob, Oct 2026); jobs posted
    // by local members are our own content and stay indexed.
    ...(job.meta.source !== "member" && { robots: { index: false, follow: true } }),
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobListingBySlug(slug).catch(soft(null));

  if (!job) notFound();

  return (
    <main className="container job-detail">
      <p className="job-detail-back">
        <Link href="/jobs">&larr; Back to The Sutton Jobs Board</Link>
      </p>

      <h1 dangerouslySetInnerHTML={{ __html: job.title.rendered }} />
      <EditInWordPress postId={job.id} />

      <div className="job-card-meta job-detail-meta">
        {job.meta.job_company && <span className="job-card-company">{job.meta.job_company}</span>}
        {job.meta.job_salary_text && <span className="job-card-salary">{job.meta.job_salary_text}</span>}
      </div>
      <time dateTime={job.date} className="job-card-date job-detail-date">
        Posted {daysAgoLabel(job.date)} &middot; {formatDate(job.date)}
      </time>

      {job.meta.source !== "member" && (
        <p className="job-external-disclaimer">
          This listing was pulled in automatically from an external job site (via the Reed API) — Secret
          Carshalton doesn&apos;t manage, vet, or handle applications for it. Reading the details here is
          fine, but you&apos;ll need to apply on the original site below.
        </p>
      )}

      <div className="post-content job-detail-content" dangerouslySetInnerHTML={{ __html: job.content.rendered }} />

      {job.meta.external_url && (
        <a
          href={job.meta.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="button-pill button-pill-active job-detail-apply"
        >
          Apply on the original site &rarr;
        </a>
      )}
    </main>
  );
}
