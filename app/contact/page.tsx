import { ContactForm } from "./_components/ContactForm";

export const metadata = {
  title: "Contact — Secret Carshalton",
  description: "Get in touch with Secret Carshalton — submit a news story, write a feature, or ask a question.",
};

/** Replaces the old WordPress contact page (Elementor + Contact Form 7). */
export default function ContactPage() {
  return (
    <main className="container auth-page contact-page">
      <h1>Contact us</h1>
      <p>
        If you would like to submit a news story or write a feature, or have a question or a correction, please get in
        touch.
      </p>
      <ContactForm />
      <p className="contact-alt">
        Or email us at <a href="mailto:info@secretcarshalton.com">info@secretcarshalton.com</a>. Advertising enquiries:
        see <a href="/advertise">Advertise with us</a>.
      </p>
    </main>
  );
}
