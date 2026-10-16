import { NextResponse } from "next/server";
import { WP_STAGING_ROOT } from "@/lib/wordpress";

/**
 * Owner-only reads and saves for the edit pages of a member's own job,
 * community post or (not yet published) directory listing. The plugins
 * check ownership; these just carry the member's token there.
 */

async function ownGet<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export interface OwnJob {
  id: number;
  title: string;
  slug: string;
  status: string;
  company: string;
  description: string;
  apply: string;
  salaryAmount: number;
  salaryPeriod: "hour" | "year";
  paymentStatus: string;
}

export interface OwnCommunityPost {
  id: number;
  title: string;
  body: string;
  status: string;
  image: string;
}

export const getOwnJob = (token: string, id: number) => ownGet<OwnJob>(token, `sc-jobs/v1/${id}`);
export const getOwnCommunityPost = (token: string, id: number) =>
  ownGet<OwnCommunityPost>(token, `sc-membership/v1/community-posts/${id}`);
/** Same shape as wp/v2/sc-listings — works for pending/draft listings the public API can't see. */
export const getOwnListing = <T,>(token: string, id: number) => ownGet<T>(token, `sc-directory/v1/${id}/own`);

/** Forwards a multipart form to an owner-checked save route. */
export async function ownSave(token: string, path: string, formData: FormData) {
  try {
    const res = await fetch(`${WP_STAGING_ROOT}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: (data as { message?: string }).message ?? "Couldn't save — please try again." }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the site — please try again." }, { status: 502 });
  }
}
