import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import {
  getDirectoryCategories,
  getDirectoryListingBySlug,
  getSpotlightArticles,
  getMemberMe,
  htmlToPlainText,
  stripHtml,
  soft,
  type WPListing,
} from "@/lib/wordpress";
import { getOwnListing } from "@/lib/owner-edit";
import { EditListingForm } from "./_components/EditListingForm";
import { SpotlightEditor } from "./_components/SpotlightEditor";
import { isGroupListing } from "../_components/ListingDetail";
import { ListedBadge } from "@/app/_components/ListedBadge";

export const metadata = { title: "Edit listing — Secret Carshalton" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect("/login");

  // A listing still waiting for approval or payment has no public page
  // (and often no slug yet), so the dashboard links to it by its number
  // and it's read through the owner-only route instead.
  const byId = /^\d+$/.test(slug);
  const [listing, profile, categories] = await Promise.all([
    byId ? getOwnListing<WPListing>(token, Number(slug)) : getDirectoryListingBySlug(slug).catch(soft(null)),
    getMemberMe(token),
    getDirectoryCategories().catch(soft([])),
  ]);

  if (!listing) notFound();
  if (!profile) redirect("/login");

  // Ownership (or being an admin/editor) is the real security boundary
  // server-side (SC_Directory_REST::check_owns_listing) — this is just so
  // neither lands on a form that will 403 on submit.
  if (profile.id !== listing.author && !profile.is_editor) {
    redirect(`/directory/${slug}`);
  }

  const isGroup = isGroupListing(listing, categories);
  const spotlight = profile.is_editor && !isGroup
    ? await getSpotlightArticles((listing.meta.sc_spotlight_slugs ?? "").split(",").map((x) => x.trim()).filter(Boolean))
    : [];

  const selectedCategorySlugs = categories
    .filter((c) => listing.sc_listing_category?.includes(c.id))
    .map((c) => c.slug);

  return (
    <main className="container auth-page">
      <h1>{isGroup ? "Edit group" : "Edit listing"}</h1>
      <EditListingForm
        listingId={listing.id}
        listingSlug={listing.slug}
        categories={categories}
        gallery={listing.sc_gallery_images ?? []}
        logo={listing.sc_logo_image ?? null}
        initial={{
          title: stripHtml(listing.title.rendered),
          description: htmlToPlainText(listing.content.rendered),
          tagline: listing.meta.sc_tagline ?? "",
          categories: selectedCategorySlugs,
          address_street: listing.meta.sc_address_street ?? "",
          address_town: listing.meta.sc_address_town ?? "",
          address_region: listing.meta.sc_address_region ?? "",
          address_postcode: listing.meta.sc_address_postcode ?? "",
          address_country: listing.meta.sc_address_country ?? "",
          phone: listing.meta.sc_phone ?? "",
          email: listing.meta.sc_email ?? "",
          website: listing.meta.sc_website ?? "",
          facebook: listing.meta.sc_facebook ?? "",
          instagram: listing.meta.sc_instagram ?? "",
          twitter: listing.meta.sc_twitter ?? "",
          linkedin: listing.meta.sc_linkedin ?? "",
          youtube: listing.meta.sc_youtube ?? "",
          plan: listing.meta.sc_plan || "free",
          claimed: Boolean(listing.meta.sc_claimed),
          claimExpiresAt: listing.meta.sc_claim_expires_at ?? "",
          featured: Boolean(listing.meta.sc_featured),
        }}
      />
      {(!byId || (listing as { status?: string }).status === "publish") && listing.slug && (
        <div style={{ marginTop: "2rem" }}>
          <ListedBadge path={isGroup ? `/community/groups/${listing.slug}` : `/directory/${listing.slug}`} />
        </div>
      )}
      {/* Spotlight articles are for businesses, not community groups. */}
      {profile.is_editor && !isGroup && (
        <SpotlightEditor
          listingId={listing.id}
          initial={spotlight.map((a) => ({ slug: a.slug, title: stripHtml(a.title) }))}
        />
      )}
    </main>
  );
}
