import { notFound } from "next/navigation";
import { requireEditor } from "../_gate";
import { MessageEditor } from "../_components/MessageEditor";

export const metadata = { title: "Edit member message — Secret Carshalton", robots: { index: false } };

export default async function EditMemberMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireEditor();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <main className="container msg-admin-page">
      <MessageEditor id={id} yourName={profile.display_name} />
    </main>
  );
}
