import { redirect } from "next/navigation";
import { getDirectoryCategories } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { SubmitListingForm } from "./_components/SubmitListingForm";

export const metadata = { title: "Add a listing — Secret Carshalton" };

export default async function DirectorySubmitPage() {
  const token = await getSessionToken();
  if (!token) redirect("/directory/manager");

  const categories = await getDirectoryCategories().catch(() => []);

  return (
    <main className="container auth-page">
      <h1>Add a listing</h1>
      <p>
        Own or run a local business, organisation or community group? Submit it here — it&apos;s free, and
        listings are reviewed before they go live.
      </p>
      <SubmitListingForm categories={categories} />
    </main>
  );
}
