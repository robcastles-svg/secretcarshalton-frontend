import { requireEditor } from "../_gate";
import { MessageEditor } from "../_components/MessageEditor";

export const metadata = { title: "New member message — Secret Carshalton", robots: { index: false } };

export default async function NewMemberMessagePage() {
  const profile = await requireEditor();
  return (
    <main className="container msg-admin-page">
      <MessageEditor yourName={profile.display_name} />
    </main>
  );
}
