import { notFound, redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { getOwnJob } from "@/lib/owner-edit";
import { EditJobForm } from "./_components/EditJobForm";

export const metadata = { title: "Edit job — Secret Carshalton" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) redirect(`/login?next=/jobs/edit/${id}`);
  if (!/^\d+$/.test(id)) notFound();

  // Owner (or staff) only — SC_Jobs_REST::check_owns_job.
  const job = await getOwnJob(token, Number(id));
  if (!job) notFound();

  return (
    <main className="container auth-page">
      <h1>Edit job</h1>
      <EditJobForm job={job} />
    </main>
  );
}
