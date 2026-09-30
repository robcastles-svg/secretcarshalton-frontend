import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { SubmitCommunityForm } from "./_components/SubmitCommunityForm";

export const metadata = { title: "Share community news — Secret Carshalton" };

export default async function SubmitCommunityPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/community/submit");

  return (
    <main className="container auth-page">
      <h1>Share community news</h1>
      <p>
        Got something local worth sharing — an event, a cause, a shout-out? Write it up and we&apos;ll review it
        before it goes live on the Community page.
      </p>
      <SubmitCommunityForm />
    </main>
  );
}
