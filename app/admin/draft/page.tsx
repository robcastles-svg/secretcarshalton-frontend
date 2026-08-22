import { redirect } from "next/navigation";
import { getMemberMe } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { DraftWorkflow } from "./_components/DraftWorkflow";

export const metadata = { title: "AI draft — Secret Carshalton" };

export default async function AdminDraftPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const profile = await getMemberMe(token);
  if (!profile?.is_editor) redirect("/dashboard");

  return (
    <main className="container admin-draft-page">
      <h1>Draft a story with AI</h1>
      <p className="dashboard-hint">
        Paste in notes, a press release, or anything else you have — add photos if you&apos;ve got them.
        Claude will write a full draft in the Secret Carshalton voice. Nothing publishes automatically:
        it lands as a pending post in WordPress for you to review, edit, and approve.
      </p>
      <DraftWorkflow />
    </main>
  );
}
