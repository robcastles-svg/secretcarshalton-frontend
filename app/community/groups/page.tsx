import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { getAd, getGroupListings } from "@/lib/wordpress";

export const revalidate = 3600;

const TITLE = "Groups to join — Secret Carshalton";
const DESCRIPTION =
  "Local clubs, societies and groups around Carshalton — find one to join.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
};

export default async function CommunityGroupsPage() {
  const [listings, inFeedAd, sidebarAd] = await Promise.all([
    getGroupListings().catch(() => []),
    getAd("in_feed"),
    getAd("sidebar"),
  ]);

  const featured = listings.filter((l) => l.meta.sc_featured);
  const regular = listings.filter((l) => !l.meta.sc_featured);

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Groups to join
            <CategoryKeyIcon />
          </h1>
          <p>{DESCRIPTION}</p>
        </div>
        <Link href="/directory/submit" className="button-pill">
          List your group
        </Link>
      </div>

      <div className="post-layout">
        <div className="post-body">
          {listings.length === 0 ? (
            <p className="directory-empty">No groups listed yet — be the first to add one.</p>
          ) : (
            <>
              {featured.length > 0 && (
                <ul className="post-list directory-featured-list">
                  {featured.map((listing) => (
                    <DirectoryListingCard key={listing.id} listing={listing} />
                  ))}
                </ul>
              )}
              <ul className="post-list directory-list">
                {regular.map((listing) => (
                  <DirectoryListingCard key={listing.id} listing={listing} />
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="post-sidebar">
          <SidebarAds ads={[inFeedAd, sidebarAd]} />
        </aside>
      </div>

      <p className="community-groups-note">
        Run a local group? <Link href="/directory/submit">Add it for free</Link> — choose
        &quot;Groups to join&quot; as the category.
      </p>
    </main>
  );
}
