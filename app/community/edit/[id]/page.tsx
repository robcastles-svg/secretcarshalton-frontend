import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { getOwnCommunityPost } from "@/lib/owner-edit";
import { EditCommunityForm } from "./_components/EditCommunityForm";

export const metadata = { title: "Edit community post — Secret Carshalton" };

export default async function EditCommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) redirect(`/login?next=/community/edit/${id}`);
  if (!/^\d+$/.test(id)) notFound();

  // Owner (or staff) only — SC_Membership_REST::check_owns_community_post.
  const post = await getOwnCommunityPost(token, Number(id));
  if (!post) notFound();

  return (
    <main className="container auth-page">
      <h1>Edit community post</h1>
      <EditCommunityForm post={post} />
    </main>
  );
}
