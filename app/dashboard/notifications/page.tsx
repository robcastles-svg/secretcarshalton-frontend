import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { WP_STAGING_ROOT } from "@/lib/wordpress";
import type { Notifications } from "@/lib/notifications";
import { ActivityRow } from "@/app/_components/notifications/ActivityRow";
import { MessageCard } from "@/app/_components/notifications/MessageCard";

export const metadata = { title: "Notifications — Secret Carshalton", robots: { index: false } };

/**
 * "See all" from the bell: messages still showing, then the member's last
 * 50 activity items. Read-only — the bell is where things get marked seen
 * and messages get closed or reopened.
 */
export default async function NotificationsPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/dashboard/notifications");

  let data: Notifications | null = null;
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) redirect("/login?next=/dashboard/notifications");
    if (res.ok) data = await res.json();
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
  }

  const activity = data?.activity ?? [];
  const messages = data?.messages ?? [];

  return (
    <main className="container auth-page">
      <p className="msg-admin-back">
        <Link href="/dashboard">← Your dashboard</Link>
      </p>
      <h1>Notifications</h1>
      {!data && <p className="auth-error">Couldn&apos;t load your notifications — please try again in a moment.</p>}
      {data && messages.length === 0 && activity.length === 0 && (
        <p className="dashboard-hint">Nothing yet. Replies, approvals and updates on what you&apos;ve posted will show up here.</p>
      )}
      {messages.length > 0 && (
        <div className="notif-page-list" style={{ marginBottom: "1.5rem" }}>
          {messages.map((m) => (
            <MessageCard key={m.id} message={{ ...m, dismissible: false }} />
          ))}
        </div>
      )}
      {activity.length > 0 && (
        <div className="notif-page-list">
          {activity.map((a) => (
            <ActivityRow key={a.id} item={a} />
          ))}
        </div>
      )}
      <p className="dashboard-hint" style={{ marginTop: "1.5rem" }}>
        Activity is kept for 90 days. <Link href="/dashboard#email-settings">Email settings</Link>
      </p>
    </main>
  );
}
