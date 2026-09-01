import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import {
  getDirectoryCategories,
  getDirectoryListingBySlug,
  getMemberMe,
  htmlToPlainText,
  stripHtml,
} from "@/lib/wordpress";
import { EditListingForm } from "./_components/EditListingForm";

export const metadata = { title: "Edit listing — Secret Carshalton" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const token = await getSessionToken();
  if (!token) redirect("/login");

  const [listing, profile, categories] = await Promise.all([
    getDirectoryListingBySlug(slug).catch(() => null),
    getMemberMe(token),
    getDirectoryCategories().catch(() => []),
  ]);

  if (!listing) notFound();
  if (!profile) redirect("/login");

  // Ownership (or being an admin/editor) is the real security boundary
  // server-side (SC_Directory_REST::check_owns_listing) — this is just so
  // neither lands on a form that will 403 on submit.
  if (profile.id !== listing.author && !profile.is_editor) {
    redirect(`/directory/${slug}`);
  }

  const selectedCategorySlugs = categories
    .filter((c) => listing.sc_listing_category?.includes(c.id))
    .map((c) => c.slug);

  return (
    <main className="container auth-page">
      <h1>Edit listing</h1>
      <EditListingForm
        listingId={listing.id}
        listingSlug={listing.slug}
        categories={categories}
        gallery={listing.sc_gallery_images ?? []}
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
        }}
      />
    </main>
  );
}
