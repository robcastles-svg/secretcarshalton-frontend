import Link from "next/link";
import { parseEventDate, type WPScEvent } from "@/lib/wordpress";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function EventCalendarMonth({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: WPScEvent[];
}) {
  const eventsByDay = new Map<number, WPScEvent[]>();
  for (const event of events) {
    const start = parseEventDate(event.meta.sc_start);
    if (!start || start.getFullYear() !== year || start.getMonth() + 1 !== month) continue;
    const day = start.getDate();
    const list = eventsByDay.get(day) ?? [];
    list.push(event);
    eventsByDay.set(day, list);
  }

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): 0=Sun..6=Sat — shift so the grid starts on Monday.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const cells: Array<{ day: number | null; events: WPScEvent[] }> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, events: [] });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, events: eventsByDay.get(day) ?? [] });
  while (cells.length % 7 !== 0) cells.push({ day: null, events: [] });

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  return (
    <div className="event-calendar">
      <div className="event-calendar-header">
        <Link href={`/events?view=calendar&year=${prev.year}&month=${prev.month}`} aria-label="Previous month">
          ←
        </Link>
        <h2>
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Link href={`/events?view=calendar&year=${next.year}&month=${next.month}`} aria-label="Next month">
          →
        </Link>
      </div>
      <div className="event-calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="event-calendar-grid">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={
              "event-calendar-cell" +
              (cell.day === null ? " empty" : "") +
              (isCurrentMonth && cell.day === today.getDate() ? " today" : "")
            }
          >
            {cell.day !== null && (
              <>
                <span className="event-calendar-daynum">{cell.day}</span>
                <ul>
                  {cell.events.slice(0, 3).map((event) => (
                    <li key={event.id}>
                      <Link href={`/events/${event.slug}`} dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                    </li>
                  ))}
                  {cell.events.length > 3 && <li className="event-calendar-more">+{cell.events.length - 3} more</li>}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
