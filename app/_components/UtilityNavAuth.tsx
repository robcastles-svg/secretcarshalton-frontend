import Link from "next/link";
import { getSessionToken } from "@/lib/auth";

/** The utility bar's own login-state link(s) — same reasoning as MemberBenefitsBar, split out and Suspense-wrapped so this cookie read doesn't block the rest of the layout's static shell. */
export async function UtilityNavAuth() {
  const sessionToken = await getSessionToken();
  return sessionToken ? (
    <Link href="/dashboard">Member dashboard</Link>
  ) : (
    <>
      <Link href="/register">Join</Link>
      <Link href="/login">Login</Link>
    </>
  );
}
