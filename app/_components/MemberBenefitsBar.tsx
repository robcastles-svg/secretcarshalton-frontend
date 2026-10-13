import Link from "next/link";
import { Suspense } from "react";
import { getSessionToken } from "@/lib/auth";
import type { Notifications } from "@/lib/notifications";
import { WP_STAGING_ROOT } from "@/lib/wordpress";
import { BellIcon } from "./notifications/BellIcon";
import { NotificationBell } from "./notifications/NotificationBell";

/**
 * Split out of layout.tsx and wrapped in <Suspense> there — this is the
 * only part of the root layout that needs a visitor's session (cookies()),
 * and reading it directly in the layout's own render made EVERY page that
 * also uses generateStaticParams + ISR (just /[slug], today) throw
 * DYNAMIC_SERVER_USAGE the first time Next tried to generate an
 * on-demand page (any post slug outside the ~30 pre-rendered at build
 * time) after a fresh deploy — Next won't let a dynamic, per-visitor read
 * block/poison an attempt to produce a cacheable static shell. Isolating
 * it here lets the rest of the layout render normally while this one
 * sliver streams in separately per request.
 *
 * Logged in, it's the member's own bar: "Member dashboard" on the left
 * and the notification bell on the right (Rob, 2026-10). Because this
 * piece already renders per visitor, the bell's messages come with it —
 * in their own Suspense, so the bar itself never waits on the CMS.
 */
export async function MemberBenefitsBar() {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return (
      <div className="member-benefits-bar">
        <Link href="/register" className="container member-benefits-inner">
          Become a member
          <Arrow />
        </Link>
      </div>
    );
  }

  return (
    <div className="member-benefits-bar member-benefits-bar-loggedin">
      <div className="container member-benefits-row">
        <Link href="/dashboard" className="member-benefits-inner member-benefits-inner-left">
          Member dashboard
          <Arrow />
        </Link>
        {/* The bar shows straight away; only the bell waits for its data. */}
        <Suspense fallback={<BellPlaceholder />}>
          <BellWithData token={sessionToken} />
        </Suspense>
      </div>
    </div>
  );
}

async function BellWithData({ token }: { token: string }) {
  return <NotificationBell initial={await getNotifications(token)} />;
}

function BellPlaceholder() {
  return (
    <div className="notif-wrap">
      <span className="notif-bell" aria-hidden="true">
        <BellIcon />
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <svg className="member-benefits-arrow" width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M0 7h20M14 1l6 6-6 6" />
    </svg>
  );
}

/**
 * Short timeout and a quiet null on any failure: this renders on every
 * page for a logged-in member, so a slow or unreachable CMS must never
 * hold the page up — the bell just shows without a count.
 */
async function getNotifications(token: string): Promise<Notifications | null> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/sc-membership/v1/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
