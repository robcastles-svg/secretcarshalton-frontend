import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { JOB_RATE_BRACKETS } from "@/lib/pricing";
import { SubmitJobForm } from "./_components/SubmitJobForm";

export const metadata = { title: "Post a job — Secret Carshalton" };

/**
 * Where the Jobs board's own "Add a job" button sends people — one page,
 * styled like /advertise (same navy hero, same .adv-* building blocks),
 * rather than a separate explain page + form. Jobs have no free tier
 * (every post is paid, priced by the role's hourly rate), so there's no
 * branching to walk through — a single page with the pitch up top and
 * the form at the bottom is simpler than two hops for a one-decision
 * product. /advertise and the dashboard's own Jobs links point straight
 * here too, same as before.
 */
export default async function JobsManagerPage() {
  const token = await getSessionToken();

  return (
    <main className="adv-page">
      {/* Hero */}
      <section className="adv-hero">
        <div className="adv-hero-inner">
          <div className="adv-hero-copy">
            <span className="adv-eyebrow adv-eyebrow-gold">Jobs</span>
            <h1 className="adv-hero-title">Post your job in seconds</h1>
            <p className="adv-hero-subtitle">
              Reach a local audience — priced by the role&apos;s hourly rate, reviewed before it goes live.
            </p>
            <div className="adv-hero-ctas">
              <a href="#post-a-job" className="button-pill adv-btn-gold">
                Post a job
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="adv-how">
        <div className="adv-how-inner">
          <div className="adv-how-step">
            <span className="adv-how-number">1</span>
            <div>
              <div className="adv-how-title">Fill in the details</div>
              <div className="adv-how-text">Role, pay, hours and how to apply.</div>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">2</span>
            <div>
              <div className="adv-how-title">We review &amp; arrange payment</div>
              <div className="adv-how-text">No automated payment yet — we&apos;ll be in touch to arrange it (PayPal).</div>
            </div>
          </div>
          <div className="adv-how-step">
            <span className="adv-how-number">3</span>
            <div>
              <div className="adv-how-title">Live for 7 days</div>
              <div className="adv-how-text">Placed at the top of the jobs board, then expires automatically.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing + form */}
      <section id="post-a-job" className="adv-section adv-closing">
        <div className="adv-section-intro">
          <span className="adv-eyebrow">Pricing</span>
          <h2 className="adv-h2">Priced by the hourly rate</h2>
          <p className="adv-lede">One flat price for a 7-day listing, based on what the role pays.</p>
        </div>

        <div className="adv-rate-table">
          {JOB_RATE_BRACKETS.map((b) => (
            <div key={b.slug} className="adv-rate-row">
              <span>{b.label}</span>
              <strong>{b.price} for 7 days</strong>
            </div>
          ))}
        </div>

        {token ? (
          <div className="adv-inline-form">
            <h3 className="adv-card-title">Post your job</h3>
            <SubmitJobForm />
          </div>
        ) : (
          <div className="adv-cta-box">
            <Link href="/login?next=/jobs/manager" className="button-pill">
              Sign in to post a job
            </Link>
            <p className="dashboard-hint">
              Free to join — <Link href="/register">create an account</Link> if you don&apos;t have one.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
