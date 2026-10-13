import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getJobListings, getJobLocationsByIds, getMemberJobListings, type WPJobListing, soft } from "@/lib/wordpress";
import { CARSHALTON, geocodePlace, milesBetween } from "@/lib/geocode";
import { annualSalary } from "@/lib/pricing";
import { JobsBoard, type JobCard } from "./_components/JobsBoard";

export const revalidate = 3600;

export const metadata = { title: "The Sutton Jobs Board — Secret Carshalton" };

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

/** "CR43ND" → "CR4 3ND"; place names unchanged. */
function prettyLocation(name: string) {
  const m = name.trim().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i);
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : name;
}

/**
 * Pay as a yearly figure, for the "By pay" sort. Member jobs store an amount
 * and period; Reed only gives text like "£14 - £16" or "£37,800 - £41,500"
 * with no period, so the period is read from the size of the figure: under
 * £60 an hour, under £1,000 a day (260 working days), else a year. A range
 * is ranked by its lower figure ("pays at least"), so a typo'd top figure
 * in Reed's data (e.g. "£35,602 - £543,282") can't jump the queue.
 */
function payPerYear(job: WPJobListing): number | null {
  const m = job.meta;
  if (m.job_salary_amount && (m.job_salary_period === "hour" || m.job_salary_period === "year")) {
    return annualSalary(Number(m.job_salary_amount), m.job_salary_period);
  }
  const amounts = (m.job_salary_text ?? "").match(/\d[\d,]*(?:\.\d+)?/g)?.map((n) => Number(n.replace(/,/g, ""))) ?? [];
  const valid = amounts.filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return null;
  const low = Math.min(...valid);
  if (low < 60) return annualSalary(low, "hour");
  if (low < 1000) return low * 260;
  return low;
}

async function toCards(jobs: WPJobListing[], locationNames: Map<number, string>): Promise<JobCard[]> {
  return Promise.all(
    jobs.map(async (job) => {
      const raw = job.job_location?.map((id) => locationNames.get(id)).find(Boolean) ?? "";
      const coords = raw ? await geocodePlace(raw).catch(() => null) : null;
      return {
        id: job.id,
        slug: job.slug,
        titleHtml: job.title.rendered,
        company: job.meta.job_company ?? "",
        salary: job.meta.job_salary_text ?? "",
        date: job.date,
        dateLabel: `${daysAgoLabel(job.date)} · ${formatDate(job.date)}`,
        featured: Boolean(job.meta.featured),
        location: raw ? prettyLocation(raw) : "",
        miles: coords ? Math.round(milesBetween(CARSHALTON, coords) * 10) / 10 : null,
        payPerYear: payPerYear(job),
      };
    })
  );
}

export default async function JobsPage() {
  const [allJobs, everyMemberJob] = await Promise.all([
    getJobListings().catch(soft([])),
    getMemberJobListings().catch(soft(null)),
  ]);
  // Member jobs come from their own lookup (the Reed sync soon pushes them
  // out of the newest 100); if that fails, fall back to the ones in it.
  const memberJobs = everyMemberJob ?? allJobs.filter((j) => j.meta.source === "member");

  // Reed-synced ("api") and member-submitted ("member") listings are kept
  // in two separate sections rather than merged into one board — Rob's
  // call, since the external-sources disclaimer below only applies to one
  // of them and mixing the two would blur that distinction. A member job
  // Rob has marked Featured (admin-only toggle) goes first under "Posted
  // locally", with its pink border and badge; "From around the area" is
  // external listings only.
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const apiJobs = allJobs.filter((j) => j.meta.source !== "member" && new Date(j.date).getTime() >= cutoff);
  const localJobs = [...memberJobs.filter((j) => j.meta.featured), ...memberJobs.filter((j) => !j.meta.featured)];

  // Location names for the "Nearest to Carshalton" sort and the card's
  // location line (Reed gives a town or a postcode per job).
  const terms = await getJobLocationsByIds([...localJobs, ...apiJobs].flatMap((j) => j.job_location ?? [])).catch(
    soft([])
  );
  const locationNames = new Map(terms.map((t) => [t.id, t.name]));
  const [localCards, apiCards] = await Promise.all([toCards(localJobs, locationNames), toCards(apiJobs, locationNames)]);

  return (
    <>
      <div className="section-hero">
        <div className="container page-header-row">
          <div>
            <h1>
              The Sutton Jobs Board
              <CategoryKeyIcon />
            </h1>
            <p>Local vacancies from around Carshalton, Sutton and the surrounding area.</p>
          </div>
          <Link href="/jobs/manager" className="button-pill">
            Add a job
          </Link>
        </div>
      </div>

      <main className="container">
        <JobsBoard
          localJobs={localCards}
          apiJobs={apiCards}
          disclaimer={
            <p className="job-external-disclaimer">
              These listings are pulled in automatically from external job sites (via the Reed API), posted in the
              last 7 days — Secret Carshalton doesn&apos;t manage or vet them. Click a job to read the details here,
              then apply on the original site.
            </p>
          }
          emptyApi={
            <p className="directory-empty">
              No jobs posted in the last 7 days — check back soon, this board updates automatically every day.
            </p>
          }
        />
      </main>
    </>
  );
}
