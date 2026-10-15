// Pure validators for private applicant file paths. No network or secrets.
// Accept only server-generated UUID paths under the expected bucket.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LEGACY_PATH = new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(pdf|jpg|png)$`);
const R2_PATH = new RegExp(`^r2/(${UUID})/(${UUID})/(${UUID})\\.(pdf|jpg|png)$`);

export function isR2Path(path: string): boolean {
  return R2_PATH.test(path);
}

export interface CleanupEntry {
  bucket: string;
  path: string;
  application_id: string;
}
export type CleanupProvider = "r2" | "supabase";

/** Reject unexpected buckets, paths and IDs before issuing DELETE to a provider. */
export function cleanupProvider(entry: CleanupEntry): CleanupProvider | null {
  if (entry.bucket !== "application-files") return null;
  const r2 = R2_PATH.exec(entry.path);
  if (r2) return r2[2] === entry.application_id ? "r2" : null;
  const legacy = LEGACY_PATH.exec(entry.path);
  if (legacy) return legacy[2] === entry.application_id ? "supabase" : null;
  return null;
}
