import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { SubmitAdForm } from "./_components/SubmitAdForm";

export const metadata = { title: "Advertise — Secret Carshalton" };

export default async function AdvertisePage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/advertise");

  return (
    <main className="container auth-page">
      <h1>Advertise</h1>
      <p>Write your own text ad, choose where it appears, and see it go live once payment&apos;s confirmed.</p>
      <SubmitAdForm />
    </main>
  );
}
