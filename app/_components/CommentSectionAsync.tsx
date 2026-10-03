import { getSessionToken } from "@/lib/auth";
import { getMemberMe, type WPComment } from "@/lib/wordpress";
import { CommentSection } from "./CommentSection";

/**
 * Resolves the viewer's own session (cookies()) and wraps CommentSection
 * with it — kept separate from the page component and rendered inside a
 * <Suspense> boundary at the call site, same reasoning as
 * MemberBenefitsBar/UtilityNavAuth: this read is the one genuinely
 * per-visitor part of an otherwise cacheable ISR page, and calling it
 * directly in the page's own render was throwing DYNAMIC_SERVER_USAGE the
 * first time a post outside the pre-rendered set got requested after a
 * deploy.
 */
export async function CommentSectionAsync({
  postId,
  comments,
  commenterProfiles,
  kind,
}: {
  postId: number;
  comments: WPComment[];
  commenterProfiles?: Map<number, { slug: string; name: string; avatar: string; joinedAt: string }>;
  kind?: "comment" | "review";
}) {
  const sessionToken = await getSessionToken();
  const profile = sessionToken ? await getMemberMe(sessionToken) : null;

  return (
    <CommentSection
      postId={postId}
      comments={comments}
      isLoggedIn={Boolean(sessionToken)}
      commenterProfiles={commenterProfiles}
      currentUserId={profile?.id}
      kind={kind}
    />
  );
}
