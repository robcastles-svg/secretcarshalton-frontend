import { redirect } from "next/navigation";

/**
 * Retired — this page's free-vs-featured comparison and tier picker now
 * live directly on /directory/submit (adding a listing and going
 * Featured are the same form, not two separate pages/trips), so this
 * redirects there instead of 404ing for anyone with the old link
 * bookmarked or indexed.
 */
export default function FeaturedListingRedirect() {
  redirect("/directory/submit");
}
