/**
 * Sort payment evidence by the displayed application sequence used by the
 * staff roster. The original immutable submission sequence is a fallback.
 * All slips belonging to the same applicant stay adjacent.
 */
export interface SequencedApplicant {
  id: string;
  display_position_order?: number | null;
  position_order?: number | null;
  submitted_at?: string | null;
}

export interface ApplicantSlip {
  id: string;
  application_id: string;
  paid_at?: string | null;
}

export function applicantOrderNumber(app: SequencedApplicant | undefined): number | null {
  if (!app) return null;
  const number = app.display_position_order ?? app.position_order;
  return Number.isSafeInteger(number) && Number(number) > 0 ? Number(number) : null;
}

export function applicantOrderLabel(app: SequencedApplicant | undefined): string {
  const n = applicantOrderNumber(app);
  return n === null ? "(ไม่ระบุลำดับ)" : "(" + n + ")";
}

export function sortSlipsByApplicantOrder<T extends ApplicantSlip, A extends SequencedApplicant>(
  slips: readonly T[],
  applicants: ReadonlyMap<string, A>,
): T[] {
  return [...slips].sort((left, right) => {
    const first = applicants.get(left.application_id);
    const second = applicants.get(right.application_id);
    const firstN = applicantOrderNumber(first) ?? Number.POSITIVE_INFINITY;
    const secondN = applicantOrderNumber(second) ?? Number.POSITIVE_INFINITY;
    if (firstN !== secondN) return firstN - secondN;
    // For legacy, unnumbered rows preserve the actual submission chronology.
    const submittedDiff = (first?.submitted_at || "").localeCompare(second?.submitted_at || "");
    if (submittedDiff !== 0) return submittedDiff;
    const applicantDiff = left.application_id.localeCompare(right.application_id);
    if (applicantDiff !== 0) return applicantDiff;
    // Multiple slips from one applicant remain consecutive, oldest first.
    return (left.paid_at || "").localeCompare(right.paid_at || "") ||
      left.id.localeCompare(right.id);
  });
}
