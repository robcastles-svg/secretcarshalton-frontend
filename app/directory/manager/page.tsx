import { redirect } from "next/navigation";

/**
 * Retired as a separate "sign in first" detour — /directory/submit (the
 * Free one-pager) now shows its hero, explainer and preview to everyone,
 * signed in or not, swapping the form for a sign-in CTA box itself (same
 * pattern as /jobs/manager). Redirects here for anyone with the old link
 * bookmarked or indexed.
 */
export default function DirectoryManagerRedirect() {
  redirect("/directory/submit");
}
