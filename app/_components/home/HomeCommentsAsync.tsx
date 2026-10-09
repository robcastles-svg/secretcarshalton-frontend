import { getSessionToken } from "@/lib/auth";
import { HomeComments, type HomeCommentItem } from "./HomeComments";

/**
 * Resolves the viewer's session (cookies()) for HomeComments' login-gated
 * name links — kept out of the post page's own render and behind a
 * <Suspense> boundary at the call site for the same ISR reason as
 * CommentSectionAsync (see its docblock).
 */
export async function HomeCommentsAsync({ comments, stacked }: { comments: HomeCommentItem[]; stacked?: boolean }) {
  const sessionToken = await getSessionToken();
  return <HomeComments comments={comments} isLoggedIn={Boolean(sessionToken)} stacked={stacked} />;
}
