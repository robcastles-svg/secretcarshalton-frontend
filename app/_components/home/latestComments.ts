import type { HomeCommentItem } from "@/app/_components/home/HomeComments";
import { getLatestComments, getMembersByIds, memberBadge, stripHtml } from "@/lib/wordpress";

/**
 * The latest comments from across the site, shaped for HomeComments —
 * shared by the homepage's "Latest comments" section and every post's
 * sidebar. Resolves each commenter's public profile (for the member-bio
 * link) the same way CommentSectionAsync does, via a batch id lookup.
 */
export async function getLatestCommentItems(count: number): Promise<HomeCommentItem[]> {
  const rawComments = await getLatestComments(count).catch(() => []);
  const commenterProfiles = await getMembersByIds(rawComments.map((c) => c.author ?? 0)).catch(
    () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string; tier?: string }>()
  );
  return rawComments.map((c) => {
    const profile = c.author ? commenterProfiles.get(c.author) : undefined;
    const postPath = c.link ? new URL(c.link).pathname : `/${c.postSlug}`;
    return {
      id: c.id,
      text: stripHtml(c.content.rendered),
      commentLink: postPath,
      authorName: profile?.name ?? c.author_name,
      authorSlug: profile?.slug,
      authorBadge: profile ? memberBadge(profile.tier) : undefined,
      articleSlug: c.postSlug,
      articleTitle: stripHtml(c.postTitle),
      // Formatted here on the server so the client component can't render
      // a different day from the server's in another timezone.
      date: c.date,
      dateLabel: new Date(c.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    };
  });
}
