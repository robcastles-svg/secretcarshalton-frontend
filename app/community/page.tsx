import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { AdSlot } from "@/app/_components/AdSlot";

export const revalidate = 3600;

export const metadata = { title: "Community — Secret Carshalton" };

/**
 * Shell for now — the real feed (community-led stories, pulled out of
 * the old Stories section) and the Groups directory both need a data
 * model that doesn't exist yet, and Rob's asked to see a specific page
 * design for Groups before that part gets built. This is the page
 * structure + a "Share community news" placeholder (same non-functional
 * pattern as Jobs' "Add a job" pill) with mock highlight cards standing
 * in for real content, so the shape of the page exists to react to.
 */
const MOCK_HIGHLIGHTS = [
  {
    title: "Beddington litter-pick this Saturday",
    blurb: "Example highlight — real community posts will replace this once the feed is wired up.",
    label: "Community",
  },
  {
    title: "New parent-and-toddler group at the library",
    blurb: "Example highlight — real community posts will replace this once the feed is wired up.",
    label: "Groups",
  },
  {
    title: "Carshalton allotments open day",
    blurb: "Example highlight — real community posts will replace this once the feed is wired up.",
    label: "Community",
  },
];

export default function CommunityPage() {
  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Community
            <CategoryKeyIcon />
          </h1>
          <p>Local groups, causes and community-led news from around Carshalton.</p>
        </div>
        <span className="button-pill button-pill-disabled" aria-disabled="true">
          Share community news — coming soon
        </span>
      </div>

      <div className="post-layout">
        <div className="post-body">
          <section>
            <div className="home-section-header">
              <h2>Highlights</h2>
            </div>
            <ul className="post-list community-highlights-list">
              {MOCK_HIGHLIGHTS.map((item) => (
                <li key={item.title}>
                  <div className="card-text">
                    <span className="card-tag">{item.label}</span>
                    <span className="card-title">{item.title}</span>
                  </div>
                  <p>{item.blurb}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className="community-groups-note">
            A directory of local groups to join is on the way — we&apos;ll link it from here once it&apos;s ready.
          </p>
        </div>

        <aside className="post-sidebar">
          <AdSlot
            placement="sidebar"
            className="sidebar-block-ad"
            placeholderClassName="sidebar-ad-placeholder"
            placeholderText="Advertise here"
          />
        </aside>
      </div>
    </main>
  );
}
