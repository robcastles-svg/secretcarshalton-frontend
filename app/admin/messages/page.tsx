import { requireEditor } from "./_gate";
import { MessagesList } from "./_components/MessagesList";

export const metadata = { title: "Member messages — Secret Carshalton", robots: { index: false } };

export default async function MemberMessagesPage() {
  await requireEditor();
  return (
    <main className="container msg-admin-page">
      <MessagesList />
    </main>
  );
}
