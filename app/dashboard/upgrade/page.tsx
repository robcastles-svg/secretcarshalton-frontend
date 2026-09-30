import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { getMemberMe, getMyListings } from "@/lib/wordpress";
import { SubmitUpgradeRequest } from "./_components/SubmitUpgradeRequest";

export const metadata = { title: "Directory upgrade — Secret Carshalton" };

export default async function DirectoryUpgradePage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/dashboard/upgrade");

  const [profile, listings] = await Promise.all([getMemberMe(token), getMyListings(token)]);
  if (!profile) redirect("/login?next=/dashboard/upgrade");

  return (
    <main className="container auth-page">
      <h1>Feature your directory listing</h1>
      <p>
        A featured listing gets a highlighted pink border and shows in the featured row above the regular list,
        on both Directory and Discover — more visibility for your business.
      </p>

      {profile.directory_upgrade_status === "pending" ? (
        <>
          <p className="dashboard-hint">You already have a request pending review.</p>
          <Link href="/dashboard" className="button-pill button-pill-secondary">
            Back to dashboard
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
        <SubmitUpgradeRequest listings={listings} />
      )}
    </main>
  );
}
