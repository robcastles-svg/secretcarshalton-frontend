import { OneOffDonation } from "./_components/OneOffDonation";

export const metadata = {
  title: "Donate — Secret Carshalton",
  description: "Support Secret Carshalton with a monthly, annual or one-off donation.",
};

/**
 * Replaces the old WordPress donate page (Elementor Pro forms, which
 * stopped working once Elementor Pro was switched off). Monthly and annual
 * donations go straight to Rob's PayPal subscription plans; one-off
 * donations use the site's own PayPal checkout (see OneOffDonation).
 */
const PLAN = (id: string) => `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${id}`;

const MONTHLY = [
  { amount: 4, url: PLAN("P-8ME63863V29329342NEARNXQ") },
  { amount: 7, url: PLAN("P-8AR949880F155862PNEBFQSA") },
  { amount: 12, url: PLAN("P-3MY96967HC291973BNEBFTLA") },
];

const ANNUAL = [
  { amount: 40, url: PLAN("P-0XT12299NA484172TNEBFULI") },
  { amount: 70, url: PLAN("P-0F5436654B579563DNEBFU7I") },
  { amount: 120, url: PLAN("P-94798184FK4231033NEBFVTI") },
];

function PlanLinks({ plans, per }: { plans: { amount: number; url: string }[]; per: string }) {
  return (
    <div className="donate-amounts">
      {plans.map((p) => (
        <a key={p.amount} className="donate-amount" href={p.url} target="_blank" rel="noopener noreferrer">
          £{p.amount}
          <small>{per}</small>
        </a>
      ))}
    </div>
  );
}

export default function DonatePage() {
  return (
    <main className="container donate-page">
      <h1>Support Secret Carshalton</h1>

      <div className="donate-why">
        <p>
          “I really care about Carshalton and love sharing its stories. This website is my way of celebrating the
          area and bringing a bit of local intrigue and fun.
        </p>
        <p>
          Running the site does take a lot of time and money, though — we get plenty of visitors (which is great!)
          but keeping everything running smoothly and adding new features isn’t cheap.
        </p>
        <p>
          There’s lots more planned, and every little bit of support helps — whether it’s the price of a coffee or
          more. Advertising brings in a small amount, but it doesn’t cover all the costs. If you enjoy Secret
          Carshalton and want to see it grow, please consider making a small donation. It really does make a
          difference.”
        </p>
        <p className="donate-sign">Secret Carshalton</p>
      </div>

      <div className="donate-options">
        <section className="donate-card">
          <h2>Monthly</h2>
          <PlanLinks plans={MONTHLY} per="a month" />
        </section>
        <section className="donate-card">
          <h2>Annual</h2>
          <PlanLinks plans={ANNUAL} per="a year" />
        </section>
        <section className="donate-card">
          <h2>One-off</h2>
          <OneOffDonation />
        </section>
      </div>

      <p className="donate-note">
        Monthly and annual donations open PayPal, where you can pay as a guest by card or log in to your PayPal
        account, and cancel at any time.
      </p>
    </main>
  );
}
