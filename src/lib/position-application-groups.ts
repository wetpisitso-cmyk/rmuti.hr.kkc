import type { Filters } from "../types/models";

export type ApplicationBar = { name: string; value: number };
type RoundWindow = {
  year_be: number;
  opens_at: string;
  closes_at: string;
  published: boolean;
  archived: boolean;
};
export type PositionWithWindow = {
  id: string;
  title: string;
  round_id: string;
  department_id: string;
  published: boolean;
  archived: boolean;
  recruitment_rounds: RoundWindow | null;
};
export type PositionStatus = "open" | "closed" | "upcoming";

const normalizeTitle = (title: string) => title.replace(/\s+/g, " ").trim();

/** Determine status from the announcement's real UTC instants (displayed in Thai time). */
export function positionStatus(job: PositionWithWindow, nowMs: number): PositionStatus {
  const round = job.recruitment_rounds;
  if (!round || job.archived || !job.published || round.archived || !round.published) return "closed";
  const start = Date.parse(round.opens_at), end = Date.parse(round.closes_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return "closed";
  if (nowMs < start) return "upcoming";
  return nowMs <= end ? "open" : "closed";
}

export function groupPositionApplicationBars(
  counts: readonly ApplicationBar[],
  jobs: readonly PositionWithWindow[],
  filters: Pick<Filters, "year" | "round" | "job" | "department" | "status" | "search" | "from" | "to">,
  nowMs: number,
): { open: ApplicationBar[]; closed: ApplicationBar[]; upcoming: ApplicationBar[] } {
  const matched = jobs.filter(job =>
    (!filters.year || job.recruitment_rounds?.year_be === Number(filters.year)) &&
    (!filters.round || job.round_id === filters.round) &&
    (!filters.job || job.id === filters.job) &&
    (!filters.department || job.department_id === filters.department)
  );
  const byTitle = new Map<string, PositionWithWindow[]>();
  for (const job of matched) {
    const title = normalizeTitle(job.title);
    byTitle.set(title, [...(byTitle.get(title) || []), job]);
  }
  const barCounts = new Map<string, ApplicationBar>();
  for (const bar of counts) {
    const key = normalizeTitle(bar.name);
    const current = barCounts.get(key);
    barCounts.set(key, { name: key, value: (current?.value || 0) + bar.value });
  }
  // Keep open positions visible even while they have zero submissions.
  // Applicant-level filters should not introduce artificial zero-count results.
  if (!filters.status && !filters.search && !filters.from && !filters.to) {
    for (const [title, positions] of byTitle) {
      if (!barCounts.has(title) && positions.some(j => positionStatus(j, nowMs) === "open")) {
        barCounts.set(title, { name: title, value: 0 });
      }
    }
  }
  const grouped: { open: ApplicationBar[]; closed: ApplicationBar[]; upcoming: ApplicationBar[] } = {
    open: [], closed: [], upcoming: [],
  };
  for (const [title, count] of barCounts) {
    const positions = byTitle.get(title) || [];
    // Same-title positions from several rounds are displayed as one count, as
    // the existing staff_dashboard SQL already aggregates by the job title.
    const states = positions.map(j => positionStatus(j, nowMs));
    const status: PositionStatus = states.includes("open") ? "open"
      : states.includes("upcoming") ? "upcoming" : "closed";
    grouped[status].push(count);
  }
  for (const rows of Object.values(grouped)) {
    rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "th"));
  }
  return grouped;
}
