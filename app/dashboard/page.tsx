import { redirect } from "next/navigation";
import Link from "next/link";
import { getMemberMe, getMyComments, getMyEvents, getMyListings, linkForPostType } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { LogoutButton } from "./_components/LogoutButton";
import { RequestUpgradeButton } from "./_components/RequestUpgradeButton";
import { VerifyEmailBanner } from "./_components/VerifyEmailBanner";

export const metadata = { title: "Your dashboard — Secret Carshalton" };

const UPGRADE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not approved",
};

const POST_STATUS_LABEL: Record<string, string> = {
  publish: "Live",
  pending: "Awaiting review",
  draft: "Draft",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Matches SC_Membership_Tiers::all() in wordpress-plugins/sc-membership —
// keep these two in sync if the tier ladder changes.
const TIERS = [
  { slug: "newcomer", label: "Newcomer", threshold: 0 },
  { slug: "regular", label: "Regular", threshold: 50 },
  { slug: "local_legend", label: "Local Legend", threshold: 200 },
  { slug: "carshalton_champion", label: "Carshalton Champion", threshold: 500 },
];

export default async function DashboardPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const profile = await getMemberMe(token);
  if (!profile) redirect("/login");

  const [myListings, myEvents, myComments] = await Promise.all([
    getMyListings(token),
    getMyEvents(token),
    getMyComments(token),
  ]);

  return (
    <main className="container dashboard">
      <div className="dashboard-header">
        <h1>Your dashboard</h1>
        <LogoutButton />
      </div>

      {!profile.email_verified && <VerifyEmailBanner />}

      {profile.is_editor && (
        <section className="dashboard-section dashboard-editor-cta">
          <h2>Editorial</h2>
          <p className="dashboard-hint">Draft a new story from notes or photos, with Claude&apos;s help.</p>
          <Link href="/admin/draft" className="button-pill">
            Draft a story
          </Link>
        </section>
      )}

      <section className="dashboard-section dashboard-account">
        <h2>Account</h2>
        <div className="dashboard-account-row">
          <div className="dashboard-avatar" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div>
            <button type="button" className="button-pill button-pill-secondary" disabled>
              Upload photo
            </button>
            <p className="dashboard-hint">Photo uploads aren&apos;t connected yet — coming soon.</p>
          </div>
        </div>
        <p className="dashboard-hint">
          Username and email aren&apos;t shown here yet — coming soon, once account details are wired up.
        </p>
        <a
          className="button-pill button-pill-secondary"
          href="https://www.staging19.secretcarshalton.com/wp-login.php?action=lostpassword"
        >
          Change password
        </a>
      </section>

      <div className="dashboard-tier-card">
        <div className="dashboard-tier-badge">{profile.tier.label}</div>
        <p className="dashboard-points">{profile.points} points</p>
        {profile.next_tier && profile.points_to_next_tier !== null && (
          <p className="dashboard-progress">
            {profile.points_to_next_tier} points to <strong>{profile.next_tier.label}</strong>
          </p>
        )}
        <p className="dashboard-joined">Member since {new Date(profile.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

        <details className="dashboard-tier-explainer">
          <summary>How tiers &amp; points work</summary>
          <p>Points build up as you take part around the site:</p>
          <ul>
            <li>+2 for a comment that gets approved</li>
            <li>+5 for RSVPing to an event</li>
            <li>+15 for claiming a directory listing</li>
          </ul>
          <ul className="dashboard-tier-ladder">
            {TIERS.map((tier) => (
              <li key={tier.slug} className={profile.tier.slug === tier.slug ? "current" : undefined}>
                {tier.label}
                <span>{tier.threshold}+ points</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <section className="dashboard-section">
        <h2>Your directory listing{myListings.length === 1 ? "" : "s"}</h2>
        {myListings.length === 0 ? (
          <p className="dashboard-hint">Nothing yet — claim an existing listing or add a new one.</p>
        ) : (
          <ul className="dashboard-my-list">
            {myListings.map((listing) => (
              <li key={listing.id}>
                <span className={`dashboard-status-badge dashboard-status-${listing.status}`}>
                  {POST_STATUS_LABEL[listing.status] ?? listing.status}
                </span>
                {listing.status === "publish" ? (
                  <Link href={`/directory/${listing.slug}`}>{listing.title}</Link>
                ) : (
                  <span>{listing.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="dashboard-section-actions">
          <Link href="/directory" className="button-pill button-pill-secondary">
            Browse the directory
          </Link>
          <Link href="/directory/submit" className="button-pill">
            Add a listing
          </Link>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Your event{myEvents.length === 1 ? "" : "s"}</h2>
        {myEvents.length === 0 ? (
          <p className="dashboard-hint">Nothing submitted yet.</p>
        ) : (
          <ul className="dashboard-my-list">
            {myEvents.map((event) => (
              <li key={event.id}>
                <span className={`dashboard-status-badge dashboard-status-${event.status}`}>
                  {POST_STATUS_LABEL[event.status] ?? event.status}
                </span>
                {event.status === "publish" ? (
                  <Link href={`/events/${event.slug}`}>{event.title}</Link>
                ) : (
                  <span>{event.title}</span>
                )}
                <Link href={`/events/${event.slug}/edit`} className="dashboard-my-list-edit">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="dashboard-section-actions">
          <Link href="/events" className="button-pill button-pill-secondary">
            Browse events
          </Link>
          <Link href="/events/submit" className="button-pill">
            Submit an event
          </Link>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Your comments</h2>
        {myComments.length === 0 ? (
          <p className="dashboard-hint">
            Nothing yet — comment on a story to join the conversation.
          </p>
        ) : (
          <ul className="dashboard-my-list dashboard-my-comments">
            {myComments.map((comment) => (
              <li key={comment.id}>
                <div>
                  {comment.status !== "approved" && (
                    <span className="dashboard-status-badge dashboard-status-pending">Awaiting moderation</span>
                  )}
                  {(() => {
                    const link = linkForPostType(comment.post_type, comment.post_slug);
                    return link ? (
                      <Link href={link}>{comment.post_title}</Link>
                    ) : (
                      <span>{comment.post_title ?? "A post"}</span>
                    );
                  })()}
                  <time>{formatDate(comment.date)}</time>
                </div>
                <p dangerouslySetInnerHTML={{ __html: comment.content.rendered }} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Directory upgrade</h2>
        {profile.directory_upgrade_status ? (
          <p>
            Status:{" "}
            <strong>
              {UPGRADE_STATUS_LABEL[profile.directory_upgrade_status] ?? profile.directory_upgrade_status}
            </strong>
          </p>
        ) : (
          <>
            <p>Own a local business? Request a featured directory listing.</p>
            <RequestUpgradeButton />
          </>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Recent activity</h2>
        {profile.recent_activity.length === 0 ? (
          <p>Nothing yet — comment on a story, RSVP to an event, or claim your directory listing to start earning points.</p>
        ) : (
          <ul className="dashboard-activity-list">
            {profile.recent_activity.map((entry, i) => (
              <li key={i}>
                <span className="dashboard-activity-points">+{entry.points}</span>
                <span>{entry.reason}</span>
                <time>{new Date(entry.date).toLocaleDateString("en-GB")}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
