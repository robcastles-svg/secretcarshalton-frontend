import { NewsletterForm } from "./_components/NewsletterForm";

export const metadata = { title: "Newsletter — Secret Carshalton" };

export default function NewsletterPage() {
  return (
    <main className="container auth-page">
      <h1>Insider</h1>
      <p>
        The Secret Carshalton newsletter — local news, walks, events and history, straight to your
        inbox. No spam, unsubscribe any time.
      </p>
      <NewsletterForm />
    </main>
  );
}
