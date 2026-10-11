import { AboutMiniNav } from "@/app/_components/AboutMiniNav";
import { EmailOctopusForm } from "./_components/EmailOctopusForm";

export const metadata = {
  title: "Insider newsletter — Secret Carshalton",
  description: "Stay up-to-date with the latest news and stories from Secret Carshalton, straight to your inbox.",
};

// A past issue, as linked from the WordPress newsletter page.
const EXAMPLE_EMAIL_URL =
  "https://eocampaign1.com/web-version?p=2ba19ee8-8d6e-11ef-a30b-1f43fb31a639&pt=campaign&t=1730466071&s=e6d0c41ce4e9c52f913f0cc21108fc6c1ae1f65e213cf843818e0991f7c93371";

export default function NewsletterPage() {
  return (
    <>
      <AboutMiniNav activeSlug="newsletter" />
      <main className="container newsletter-page">
        <h1 className="newsletter-page-logo">
          <img src="/insider-logo.png" alt="Insider" width={1200} height={232} />
        </h1>
        <h2>📨 Stay up-to-date with the latest news and stories</h2>
        <EmailOctopusForm />
        <p className="newsletter-page-confirm">Check your inbox to confirm subscription.</p>
        <p>
          We guarantee that everyone who receives our emails wants to receive them, and that it&rsquo;s always easy
          to unsubscribe anytime from within the email itself. <a href="/privacy-policy">Privacy statement</a>.
        </p>
        <p>
          <a href={EXAMPLE_EMAIL_URL} target="_blank" rel="noopener noreferrer" className="newsletter-page-example">
            View an example email
          </a>
        </p>
      </main>
    </>
  );
}
