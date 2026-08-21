import { redirect } from "next/navigation";
import { getMemberMe } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { LogoutButton } from "./_components/LogoutButton";
import { RequestUpgradeButton } from "./_components/RequestUpgradeButton";

export const metadata = { title: "Your dashboard — Secret Carshalton" };

const UPGRADE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not approved",
};

export default async function DashboardPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const profile = await getMemberMe(token);
  if (!profile) redirect("/login");

  return (
    <main className="container dashboard">
      <div className="dashboard-header">
        <h1>Your dashboard</h1>
        <LogoutButton />
      </div>

      <div className="dashboard-tier-card">
        <div className="dashboard-tier-badge">{profile.tier.label}</div>
        <p className="dashboard-points">{profile.points} points</p>
        {profile.next_tier && profile.points_to_next_tier !== null && (
          <p className="dashboard-progress">
            {profile.points_to_next_tier} points to <strong>{profile.next_tier.label}</strong>
          </p>
        )}
        <p className="dashboard-joined">Member since {new Date(profile.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

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
