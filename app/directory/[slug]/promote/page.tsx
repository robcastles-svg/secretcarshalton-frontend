import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { GROUP_PROMOTION_PRICE } from "@/lib/pricing";
import { getDirectoryListingBySlug, getMemberMe } from "@/lib/wordpress";
import { PayNow } from "@/app/_components/PayNow";

export const metadata = { title: "Promote your group — Secret Carshalton" };

/**
 * Community Group Promotion (£10/30 days) — a separate, cheaper product
 * from the Featured Directory tiers at /dashboard/upgrade, for any
 * directory listing (groups in particular, but not restricted to the
 * "groups-to-join" category — same reasoning /dashboard/upgrade doesn't
 * restrict by category either). Mirrors /events/[slug]/feature's own
 * request-a-paid-upgrade-for-a-thing-you-own pattern. Paid online; it's
 * promoted as soon as payment goes through (SC_Directory_Payments).
 */
export default async function PromoteListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect(`/login?next=/directory/${slug}/promote`);

  const [listing, profile] = await Promise.all([
    getDirectoryListingBySlug(slug).catch(() => null),
    getMemberMe(token),
  ]);

  if (!listing) notFound();
  if (!profile) redirect("/login");

  if (profile.id !== listing.author && !profile.is_editor) {
    redirect(`/directory/${slug}`);
  }

  return (
    <main className="container auth-page">
      <h1>Promote your group</h1>
      <p>
        Give <strong dangerouslySetInnerHTML={{ __html: listing.title.rendered }} /> featured placement within
        the Community section for 30 days — more visibility than a standard listing. {GROUP_PROMOTION_PRICE}.
      </p>

      {listing.meta.sc_group_promoted ? (
        <>
          <p className="dashboard-hint">
            This listing is already promoted
            {listing.meta.sc_group_promo_expires_at &&
              ` until ${new Date(listing.meta.sc_group_promo_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
            .
          </p>
          <Link href={`/directory/${slug}`} className="button-pill button-pill-secondary">
            Back to listing
          </Link>
        </>
      ) : (
        <PayNow
          kind="group_promotion"
          id={listing.id}
          price={GROUP_PROMOTION_PRICE.split(" ")[0]}
          what="promoted in the Community section for 30 days"
          paidText="Paid — your listing is promoted until {until}."
        />
      )}
    </main>
  );
}
