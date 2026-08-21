import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { SubmitEventForm } from "./_components/SubmitEventForm";

export const metadata = { title: "Submit an event — Secret Carshalton" };

export default async function EventsSubmitPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  return (
    <main className="container auth-page">
      <h1>Submit an event</h1>
      <p>Running something local? Submit it here — events are reviewed before they go live.</p>
      <SubmitEventForm />
    </main>
  );
}
