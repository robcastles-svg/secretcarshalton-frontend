import { dateParts } from "@/lib/event-view";

/**
 * The one date tile used everywhere on the events pages: weekday in pink,
 * big day number, month in grey. `withYear` is only for the single event
 * page's header. `size="lg"` is the event page header; `sm` is cards.
 */
export function DateTile({ date, withYear = false, size = "md" }: { date: Date; withYear?: boolean; size?: "sm" | "md" | "lg" }) {
  const p = dateParts(date);
  return (
    <div className={`evx-date evx-date-${size}`} aria-label={p.label}>
      <span className="evx-date-w" aria-hidden="true">{p.weekday}</span>
      <b aria-hidden="true">{p.day}</b>
      <span className="evx-date-m" aria-hidden="true">{p.month}</span>
      {withYear && <span className="evx-date-y" aria-hidden="true">{p.year}</span>}
    </div>
  );
}
