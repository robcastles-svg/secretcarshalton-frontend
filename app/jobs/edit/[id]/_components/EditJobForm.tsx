"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OwnJob } from "@/lib/owner-edit";
import { formatJobSalary, type SalaryPeriod } from "@/lib/pricing";

/** The member's own job, same fields as SubmitJobForm. The pay is fixed once it's paid for (the price depends on it). */
export function EditJobForm({ job }: { job: OwnJob }) {
  const router = useRouter();
  const paid = job.paymentStatus === "paid";
  const [amount, setAmount] = useState(job.salaryAmount ? String(job.salaryAmount) : "");
  const [period, setPeriod] = useState<SalaryPeriod>(job.salaryPeriod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/jobs/${job.id}/update`, { method: "POST", body: new FormData(e.currentTarget) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSaving(false);
      return;
    }
    router.push("/dashboard#submissions-jobs");
    router.refresh();
  }

  const salary = Number(amount) > 0 ? Number(amount) : null;

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Job title
        <input type="text" name="title" required defaultValue={job.title} />
      </label>
      <label>
        Company / organisation
        <input type="text" name="company" defaultValue={job.company} />
      </label>
      {paid ? (
        <p className="dashboard-hint">
          Pay: {salary ? formatJobSalary(salary, period) : "—"} (fixed once the job is paid for — the price depends on
          it).
        </p>
      ) : (
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
      )}
      <label>
        How to apply
        <input type="text" name="apply_url" defaultValue={job.apply} placeholder="A link to apply, or an email address" />
      </label>
      <label>
        Description
        <textarea name="description" rows={8} required defaultValue={job.description} />
      </label>

      {error && <p className="auth-error">{error}</p>}
      <div className="dashboard-section-actions">
        <button type="submit" className="button-pill" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <Link href="/dashboard#submissions-jobs" className="button-pill button-pill-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
