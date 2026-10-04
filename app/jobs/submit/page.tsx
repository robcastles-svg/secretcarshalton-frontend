import { redirect } from "next/navigation";

/**
 * Retired as a separate page — posting a job is now one page
 * (/jobs/manager: pitch, pricing and the form together, styled like
 * /advertise), not a two-step explain-then-form flow. Redirects here for
 * anyone with the old link bookmarked or indexed.
 */
export default function JobsSubmitRedirect() {
  redirect("/jobs/manager");
}
