import Link from "next/link";
import { ReachProof } from "@/app/_components/ReachProof";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { formatUntil } from "@/lib/pricing";
import { SOCIAL_REACH_BLURB } from "@/lib/socialStats";
import { getDirectoryCategories, getMemberMe, getMyListings, soft } from "@/lib/wordpress";
import { SubmitUpgradeRequest } from "./_components/SubmitUpgradeRequest";

export const metadata = { title: "Directory upgrade — Secret Carshalton" };

export default async function DirectoryUpgradePage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/dashboard/upgrade");

  const [profile, listings, categories] = await Promise.all([
    getMemberMe(token),
    getMyListings(token),
    getDirectoryCategories().catch(soft([])),
  ]);
  if (!profile) redirect("/login?next=/dashboard/upgrade");

  // A listing Featured through online payment can be renewed from here.
  const renewable = listings.find((l) => l.featuredUntil);

  return (
    <main className="container auth-page">
      <h1>Feature your directory listing</h1>
      <p>
        A featured listing gets a highlighted pink border and shows in the featured row above the regular list,
        on both Directory and Discover — more visibility for your business. It&apos;s also where the rest of
        your profile goes: address, contact details, socials, extra categories and photos, on top of the
        title/website/category your Standard listing already has.
      </p>
      <ul className="advertise-benefits">
        <li>Around 150 views a month from your category pages alone</li>
        <li>Top ranking, above every Standard listing in your category</li>
        <li>A mention in our Facebook/Instagram stories — we reach {SOCIAL_REACH_BLURB}</li>
      </ul>
      <ReachProof audience="advertiser" />

      {profile.directory_upgrade_status === "pending" ? (
        <>
          <p className="dashboard-hint">You already have a request pending review.</p>
          <Link href="/dashboard" className="button-pill button-pill-secondary">
            Back to dashboard
          </Link>
        </>
      ) : renewable ? (
        <>
          <p>
            <strong>{renewable.title}</strong> is Featured until {formatUntil(renewable.featuredUntil)}.
          </p>
          <Link href={`/payment/pay?kind=featured&id=${renewable.id}`} className="button-pill">
            Renew Featured
          </Link>
        </>
      ) : profile.directory_upgrade_status === "approved" ? (
        <>
          <p className="dashboard-hint">You already have an approved featured upgrade.</p>
          <Link href="/dashboard" className="button-pill button-pill-secondary">
            Back to dashboard
          </Link>
        </>
      ) : listings.length === 0 ? (
        <>
          <p className="dashboard-hint">You&apos;ll need a directory listing first before you can feature one.</p>
          <Link href="/directory/submit" className="button-pill">
            Add a listing
          </Link>
        </>
      ) : (
        <SubmitUpgradeRequest listings={listings} categories={categories} />
      )}
    </main>
  );
}
