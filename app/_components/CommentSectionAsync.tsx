import { getSessionToken } from "@/lib/auth";
import { getMemberMe, getVotedCommentIds, type WPComment } from "@/lib/wordpress";
import { CommentSection } from "./CommentSection";

/**
 * Resolves the viewer's own session (cookies()) and wraps CommentSection
 * with it — kept separate from the page component and rendered inside a
 * <Suspense> boundary at the call site, same reasoning as
 * MemberBenefitsBar/UtilityNavAuth: this read is the one genuinely
 * per-visitor part of an otherwise cacheable ISR page, and calling it
 * directly in the page's own render was throwing DYNAMIC_SERVER_USAGE the
 * first time a post outside the pre-rendered set got requested after a
 * deploy. The viewer's own voted-comment-ids are fetched here for the
 * same reason — see getVotedCommentIds's own docblock for why that can't
 * just be a field on the (cached) comments themselves.
 */
export async function CommentSectionAsync({
  postId,
  comments,
  commenterProfiles,
  kind,
}: {
  postId: number;
  comments: WPComment[];
  commenterProfiles?: Map<number, { slug: string; name: string; avatar: string; joinedAt: string; tier?: string }>;
  kind?: "comment" | "review";
}) {
  const sessionToken = await getSessionToken();
  const [profile, votes] = await Promise.all([
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
    sessionToken ? getVotedCommentIds(sessionToken, comments.map((c) => c.id)) : Promise.resolve(null),
  ]);

  return (
    <CommentSection
      postId={postId}
      comments={comments}
      isLoggedIn={Boolean(sessionToken)}
      commenterProfiles={commenterProfiles}
      currentUserId={profile?.id}
      votedCommentIds={votes?.up}
      downvotedCommentIds={votes?.down}
      kind={kind}
    />
  );
}
