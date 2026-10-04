import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { SubmitGroupForm } from "./_components/SubmitGroupForm";

export const metadata = { title: "List your group — Secret Carshalton" };

/**
 * Deliberately separate from /directory/submit — same underlying
 * sc-listings data (see GROUPS_CATEGORY_SLUG in lib/wordpress.ts), but a
 * different, simpler form: no Featured tier picker, no business fields
 * (address, tagline, multi-category), just what a group needs plus the
 * flat £10 promotion option. Keeps "clear and distinct" at the frontend
 * level without a backend/plugin change.
 */
export default async function SubmitGroupPage() {
  const token = await getSessionToken();
  if (!token) redirect("/community/groups/manager");

  return (
    <main className="container auth-page">
      <h1>List your group</h1>
      <p>Tell us about your club, society or group — it&apos;s free, and it&apos;s reviewed before it goes live.</p>
      <SubmitGroupForm />
    </main>
  );
}
