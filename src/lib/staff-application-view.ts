/** Staff-only listing modes; overview and reports remain unfiltered. */
export type StaffQueueView = "open_pending" | "records";
export function staffQueueView(listOnly: boolean, recordsOnly: boolean): StaffQueueView | undefined {
  if (!listOnly) return undefined;
  return recordsOnly ? "records" : "open_pending";
}
