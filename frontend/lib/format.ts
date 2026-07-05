// Date humanizers shared across screens. All inputs are ISO strings from the API.

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(iso: string): Date {
  // Date-only strings ("2026-07-05") parse as UTC midnight; normalize to local midnight.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localMidnight(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Mon · Jul 6" */
export function humanDate(iso: string): string {
  const d = parseDay(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} · ${md}`;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

/** Relative due label: "overdue 3d" / "today" / "tomorrow" / "Mon · Jul 6". */
export function humanDue(iso: string): { label: string; tone: DueTone } {
  const diff = Math.round((parseDay(iso).getTime() - localMidnight().getTime()) / DAY_MS);
  if (diff < 0) return { label: `overdue ${-diff}d`, tone: "overdue" };
  if (diff === 0) return { label: "today", tone: "today" };
  if (diff === 1) return { label: "tomorrow", tone: "soon" };
  return { label: humanDate(iso), tone: diff <= 7 ? "soon" : "later" };
}

/** Days from today (negative = past). */
export function daysFromToday(iso: string): number {
  return Math.round((parseDay(iso).getTime() - localMidnight().getTime()) / DAY_MS);
}

/** "just now" / "12m ago" / "3h ago" / "Mon · Jul 6" for timestamps. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return humanDate(iso);
}
