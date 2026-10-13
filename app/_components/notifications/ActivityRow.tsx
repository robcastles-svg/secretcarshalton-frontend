import Link from "next/link";
import { timeAgo, type ActivityItem } from "@/lib/notifications";

const ICONS: Record<string, { tone: "pink" | "green" | "grey"; path: React.ReactNode }> = {
  reply: { tone: "pink", path: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /> },
  comment: { tone: "pink", path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  review: { tone: "pink", path: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z" /> },
  featured: { tone: "pink", path: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z" /> },
  live: { tone: "green", path: <path d="M20 6 9 17l-5-5" /> },
  approved: { tone: "green", path: <path d="M20 6 9 17l-5-5" /> },
  tier: { tone: "green", path: <><circle cx="12" cy="8" r="6" /><path d="M8.2 13.2 7 22l5-3 5 3-1.2-8.8" /></> },
  ending: { tone: "grey", path: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  info: { tone: "grey", path: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></> },
};

/** One line of the member's activity in the bell (and on /dashboard/notifications). */
export function ActivityRow({ item, fresh = false, onClick }: { item: ActivityItem; fresh?: boolean; onClick?: () => void }) {
  const icon = ICONS[item.type] ?? ICONS.info;
  const body = (
    <>
      <span className={`notif-act-icon notif-act-icon-${icon.tone}`} aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon.path}
        </svg>
      </span>
      <span className="notif-act-main">
        <span className="notif-act-text">{item.text}</span>
        <span className="notif-act-when">{timeAgo(item.date)}</span>
      </span>
      {fresh && <span className="notif-dot notif-act-dot" aria-label="New" />}
    </>
  );
  return item.link ? (
    <Link href={item.link} className={fresh ? "notif-act notif-act-fresh" : "notif-act"} onClick={onClick}>
      {body}
    </Link>
  ) : (
    <div className={fresh ? "notif-act notif-act-fresh" : "notif-act"}>{body}</div>
  );
}
