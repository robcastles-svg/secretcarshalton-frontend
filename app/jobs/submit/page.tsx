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
        Hiring locally? List your vacancy here — a paid listing, reviewed before it goes live.
      </p>
      <SubmitJobForm />
    </main>
  );
}
