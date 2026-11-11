/**
 * A staff notification leaves the active "new applications" inbox after it
 * has been read/opened, or the linked application has passed a review step.
 * Read and reviewed are not equivalent; both are retained in history.
 */
export type StaffNoticeForInbox={application_id:string|null;read_at:string|null};
export function isStaffNoticeResolved(
  notice:StaffNoticeForInbox,
  reviewedApplicationIds:ReadonlySet<string>,
):boolean{
  return Boolean(notice.read_at) ||
    Boolean(notice.application_id&&reviewedApplicationIds.has(notice.application_id));
}
