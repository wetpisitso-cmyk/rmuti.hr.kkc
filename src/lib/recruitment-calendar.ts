import type { Job } from "../types/models";

/** Calendar dates are interpreted in Thailand, while Supabase timestamps stay in UTC. */
const bangkokFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bangkokDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  const parts = bangkokFormatter.formatToParts(date);
  const field = (name: string) => parts.find((p) => p.type === name)?.value || "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

export function calendarDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addCalendarMonths(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Sunday-first month grid. Null values are intentional blank cells. */
export function calendarMonthGrid(year: number, month: number): Array<number | null> {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const grid: Array<number | null> = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

export function publishedRecruitmentJobs(jobs: readonly Job[]): Job[] {
  return jobs.filter((job) => (
    job.published &&
    !job.archived &&
    job.recruitment_rounds?.published &&
    !job.recruitment_rounds.archived &&
    !!bangkokDateKey(job.recruitment_rounds.opens_at) &&
    !!bangkokDateKey(job.recruitment_rounds.closes_at)
  ));
}

export function jobsOnCalendarDay(jobs: readonly Job[], key: string): Job[] {
  return jobs.filter((job) => {
    const start = bangkokDateKey(job.recruitment_rounds.opens_at);
    const end = bangkokDateKey(job.recruitment_rounds.closes_at);
    return start <= key && key <= end;
  }).sort((a, b) => (
    a.recruitment_rounds.opens_at.localeCompare(b.recruitment_rounds.opens_at) ||
    a.title.localeCompare(b.title, "th")
  ));
}

export function jobsInCalendarMonth(jobs: readonly Job[], year: number, month: number): Job[] {
  const first = calendarDateKey(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = calendarDateKey(year, month, lastDay);
  return jobs.filter((job) => {
    const start = bangkokDateKey(job.recruitment_rounds.opens_at);
    const end = bangkokDateKey(job.recruitment_rounds.closes_at);
    return start <= last && end >= first;
  }).sort((a, b) => (
    a.recruitment_rounds.opens_at.localeCompare(b.recruitment_rounds.opens_at) ||
    a.title.localeCompare(b.title, "th")
  ));
}

export type RecruitmentPhase = "open" | "closing" | "upcoming" | "closed";

export function recruitmentPhase(job: Job, nowMs: number): RecruitmentPhase {
  const open = new Date(job.recruitment_rounds.opens_at).getTime();
  const close = new Date(job.recruitment_rounds.closes_at).getTime();
  if (!Number.isFinite(open) || !Number.isFinite(close)) return "closed";
  if (nowMs < open) return "upcoming";
  if (nowMs > close) return "closed";
  return close - nowMs <= 48 * 60 * 60 * 1000 ? "closing" : "open";
}
