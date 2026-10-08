import Link from "next/link";
import { getSessionToken } from "@/lib/auth";

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
 */
export async function MemberBenefitsBar() {
  const sessionToken = await getSessionToken();
  return (
    <div className={`member-benefits-bar${sessionToken ? " member-benefits-bar-loggedin" : ""}`}>
      <Link href={sessionToken ? "/dashboard" : "/register"} className="container member-benefits-inner">
        {sessionToken ? "Member dashboard" : "Become a member"}
        <svg className="member-benefits-arrow" width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
          <path d="M0 7h20M14 1l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}
