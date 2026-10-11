"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { annualSalary, formatJobSalary, jobRateBracket, type SalaryPeriod } from "@/lib/pricing";

export function SubmitJobForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<SalaryPeriod>("hour");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p>
        Thanks — your job posting&apos;s been submitted. There&apos;s no automated payment yet, so we&apos;ll be
        in touch to arrange it (PayPal) — it goes live once that&apos;s sorted and we&apos;ve approved it. You
        can track the status from your dashboard.
      </p>
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
          ? `${band.price} for 7 days — ${band.label.toLowerCase()}${period === "hour" ? " (hourly pay is priced on the full-time equivalent)" : ""}.`
          : "Enter the pay to see the price."}{" "}
        There&apos;s no automated payment yet, so once you submit this, we&apos;ll review it and get in touch to
        arrange payment (PayPal). Nothing is charged now.
      </p>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Post job"}
      </button>
    </form>
  );
}
