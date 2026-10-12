"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayNow } from "@/app/_components/PayNow";
import { SpamTrap } from "@/app/_components/SpamTrap";
import { annualSalary, formatJobSalary, jobRateBracket, type SalaryPeriod } from "@/lib/pricing";

export function SubmitJobForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<SalaryPeriod>("hour");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: number; price: string } | null>(null);

  // Display only — SC_Jobs_REST works out the band itself from the pay sent.
  const salary = Number(amount) > 0 ? Number(amount) : null;
  const band = salary ? jobRateBracket(annualSalary(salary, period)) : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/jobs/submit", { method: "POST", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    const body = await res.json().catch(() => ({}));
    setSubmitted({ id: Number(body.id), price: body.price || band?.price || "" });
    router.refresh();
  }

  if (submitted) {
    return (
      <>
        <p>Thanks — your job is saved. Pay below and it goes live straight away for 7 days.</p>
        <PayNow
          kind="job"
          id={submitted.id}
          price={submitted.price}
          what="job post, live for 7 days"
          paidText="Paid — your job is live until {until}."
          viewPath="/jobs/"
        />
        <p className="dashboard-hint">You can also pay later from your dashboard.</p>
      </>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Job title
        <input type="text" name="title" required placeholder="e.g. Part-time café assistant" />
      </label>
      <label>
        Company / organisation
        <input type="text" name="company" placeholder="Who's hiring" />
      </label>
      <div className="job-salary-field">
        <label>
          Pay (£)
          <input
            type="number"
            name="salary_amount"
            required
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder={period === "hour" ? "e.g. 12.50" : "e.g. 28000"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Per
          <select name="salary_period" value={period} onChange={(e) => setPeriod(e.target.value as SalaryPeriod)}>
            <option value="hour">hour</option>
            <option value="year">year (per annum)</option>
          </select>
        </label>
      </div>
      {salary && <p className="dashboard-hint">Shown on the listing as: {formatJobSalary(salary, period)}</p>}
      <label>
        How to apply
        <input type="text" name="apply_url" placeholder="A link to apply, or an email address" />
      </label>
      <label>
        Description
        <textarea name="description" rows={6} required placeholder="Role, hours, what you're looking for…" />
      </label>

      <p className="dashboard-hint">
        {band
          ? `${band.price} for 7 days — ${band.hourlyLabel.toLowerCase()} (${band.label.toLowerCase()}).`
          : "Enter the pay to see the price."}{" "}
        You&apos;ll pay with PayPal on the next step, and the job goes live as soon as it&apos;s paid.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Post job"}
      </button>
      <SpamTrap />
    </form>
  );
}
