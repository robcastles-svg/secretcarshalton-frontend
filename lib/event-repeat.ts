/**
 * Repeating-event rules for the add-event form (events redesign, Stage 4),
 * ported from the signed-off mockup's genDates()/sumText(). Dates are
 * plain "YYYY-MM-DD" strings throughout — no timezones involved; the
 * start time is added when the form saves them.
 */

export type RepeatFreq = "daily" | "weekly" | "monthly" | "custom";
export type MonthMode = "date" | "nth" | "last";

export interface RepeatRule {
  /** First date, "YYYY-MM-DD". */
  start: string;
  freq: RepeatFreq;
  /** Every n days/weeks/months, 1–12. */
  every: number;
  /** Weekly: weekdays, 0 = Monday … 6 = Sunday. */
  weekdays: number[];
  monthMode: MonthMode;
  ends: "count" | "until";
  /** 2–52. */
  count: number;
  /** "YYYY-MM-DD" or "". */
  until: string;
  /** Custom: extra dates picked by hand (the start date is always included). */
  custom: string[];
}

export const MAX_DATES = 52;
export const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ORD = ["first", "second", "third", "fourth", "fifth"];

export function parseDay(s: string | undefined | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** 0 = Monday … 6 = Sunday */
export function weekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}
function nthOf(y: number, m: number, wd: number, n: number): Date | null {
  const first = new Date(Date.UTC(y, m, 1));
  const day = 1 + ((wd - weekday(first) + 7) % 7) + (n - 1) * 7;
  return day <= daysInMonth(y, m) ? new Date(Date.UTC(y, m, day)) : null;
}
function lastOf(y: number, m: number, wd: number): Date {
  const last = new Date(Date.UTC(y, m, daysInMonth(y, m)));
  return addDays(last, -((weekday(last) - wd + 7) % 7));
}
export function ordinal(n: number): string {
  return n > 3 && n < 21 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/** "Thu 22 Oct 2026" */
export function formatDay(d: Date, withYear = true): string {
  return `${DAYS_SHORT[weekday(d)]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
}

/** Every date the rule produces, earliest first, at most 52. */
export function generateDates(rule: RepeatRule): string[] {
  const start = parseDay(rule.start);
  if (!start) return [];
  const every = Math.max(1, Math.min(12, Math.floor(rule.every) || 1));
  const count = Math.max(2, Math.min(MAX_DATES, Math.floor(rule.count) || 2));
  const until = parseDay(rule.until);
  const out: Date[] = [];
  const done = (d: Date) => (rule.ends === "count" ? out.length >= count : !until || d > until);
  let guard = 0;

  if (rule.freq === "custom") {
    const all = [rule.start, ...rule.custom].map(parseDay).filter((d): d is Date => !!d && d >= start);
    return [...new Set(all.map(isoDay))].sort().slice(0, MAX_DATES);
  }
  if (rule.freq === "daily") {
    for (let d = start; guard++ < 400 && out.length < MAX_DATES; d = addDays(d, every)) {
      if (done(d)) break;
      out.push(d);
    }
  } else if (rule.freq === "weekly") {
    const days = rule.weekdays.length ? [...rule.weekdays].sort() : [weekday(start)];
    const weekStart = addDays(start, -weekday(start));
    outer: for (let w = 0; guard++ < 400; w += every) {
      for (const wd of days) {
        const d = addDays(weekStart, w * 7 + wd);
        if (d < start) continue;
        if (done(d) || out.length >= MAX_DATES) break outer;
        out.push(d);
      }
    }
  } else {
    const dom = start.getUTCDate();
    const wd = weekday(start);
    const nth = Math.ceil(dom / 7);
    for (let k = 0; guard++ < 200 && out.length < MAX_DATES; k += every) {
      const total = start.getUTCMonth() + k;
      const y = start.getUTCFullYear() + Math.floor(total / 12);
      const m = ((total % 12) + 12) % 12;
      const d =
        rule.monthMode === "date"
          ? dom <= daysInMonth(y, m)
            ? new Date(Date.UTC(y, m, dom))
            : null
          : rule.monthMode === "nth"
          ? nthOf(y, m, wd, nth)
          : lastOf(y, m, wd);
      if (!d) continue;
      if (done(d)) break;
      out.push(d);
    }
  }
  return out.map(isoDay);
}

/** Is the start date in the last week of its month (so "last Sunday" makes sense)? */
export function isLastWeekOfMonth(start: string): boolean {
  const d = parseDay(start);
  return !!d && d.getUTCDate() + 7 > daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
}

/** Labels for the three monthly choices, given the first date. */
export function monthChoiceLabels(start: string): Record<MonthMode, string> {
  const d = parseDay(start);
  if (!d) {
    return {
      date: "The same date each month",
      nth: "The same weekday each month",
      last: "The last weekday of each month",
    };
  }
  const w = DAYS_LONG[weekday(d)];
  const n = Math.ceil(d.getUTCDate() / 7);
  return {
    date: `The ${d.getUTCDate()}${ordinal(d.getUTCDate())} of each month`,
    nth: n <= 4 ? `The ${ORD[n - 1]} ${w} of each month` : `The fifth ${w} (only some months)`,
    last: `The last ${w} of each month`,
  };
}

function joinList(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] ?? "";
}

/**
 * The short pattern saved with the event and shown on its page and cards,
 * e.g. "Monthly, last Sunday", "Weekly, Tuesdays and Thursdays",
 * "Every 2 weeks, Saturdays", "Daily". The word before the comma is the
 * flag on list cards.
 */
export function patternText(rule: RepeatRule): string {
  const start = parseDay(rule.start);
  const n = Math.max(1, Math.floor(rule.every) || 1);
  if (rule.freq === "custom" || !start) return "Selected dates";
  if (rule.freq === "daily") return n === 1 ? "Daily" : `Every ${n} days`;
  if (rule.freq === "weekly") {
    const days = (rule.weekdays.length ? [...rule.weekdays].sort() : [weekday(start)]).map((d) => `${DAYS_LONG[d]}s`);
    const head = n === 1 ? "Weekly" : n === 2 ? "Fortnightly" : `Every ${n} weeks`;
    return `${head}, ${joinList(days)}`;
  }
  const w = DAYS_LONG[weekday(start)];
  const head = n === 1 ? "Monthly" : `Every ${n} months`;
  if (rule.monthMode === "date") return `${head}, on the ${start.getUTCDate()}${ordinal(start.getUTCDate())}`;
  if (rule.monthMode === "last") return `${head}, last ${w}`;
  return `${head}, ${ORD[Math.ceil(start.getUTCDate() / 7) - 1] ?? "fifth"} ${w}`;
}

/** The plain-English summary under the repeat options, e.g. "Every month on the last Sunday, 11 am. 4 dates, ending Sun 31 Jan 2027." */
export function summaryText(rule: RepeatRule, liveDates: string[], timeLabel: string): string {
  const start = parseDay(rule.start);
  if (!start) return "Enter a date above to see the pattern.";
  const n = Math.max(1, Math.floor(rule.every) || 1);
  let s: string;
  if (rule.freq === "custom") s = `On ${liveDates.length} dates you picked`;
  else if (rule.freq === "daily") s = n === 1 ? "Every day" : `Every ${n} days`;
  else if (rule.freq === "weekly") {
    const days = (rule.weekdays.length ? [...rule.weekdays].sort() : [weekday(start)]).map((d) => DAYS_SHORT[d]);
    s = `${n === 1 ? "Every week" : `Every ${n} weeks`} on ${joinList(days)}`;
  } else {
    const w = DAYS_LONG[weekday(start)];
    const on =
      rule.monthMode === "date"
        ? `the ${start.getUTCDate()}${ordinal(start.getUTCDate())}`
        : rule.monthMode === "nth"
        ? `the ${ORD[Math.ceil(start.getUTCDate() / 7) - 1] ?? "fifth"} ${w}`
        : `the last ${w}`;
    s = `${n === 1 ? "Every month" : `Every ${n} months`} on ${on}`;
  }
  if (timeLabel) s += `, ${timeLabel}`;
  if (liveDates.length) {
    const last = parseDay(liveDates[liveDates.length - 1]);
    s += `. ${liveDates.length} date${liveDates.length === 1 ? "" : "s"}${last ? `, ending ${formatDay(last)}` : ""}.`;
  }
  return s;
}
