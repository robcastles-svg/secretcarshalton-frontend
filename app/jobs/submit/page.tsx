import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { SubmitJobForm } from "./_components/SubmitJobForm";

export const metadata = { title: "Post a job — Secret Carshalton" };

export default async function SubmitJobPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/jobs/submit");

  return (
    <main className="container auth-page">
      <h1>Post a job</h1>
      <p>
        Free to post — hiring locally? List your vacancy here. It goes live once we&apos;ve had a quick look
        over it.
      </p>
      <SubmitJobForm />
    </main>
  );
}
