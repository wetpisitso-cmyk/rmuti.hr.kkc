import { describe, expect, it } from "vitest";
import {
  cleanupProvider,
  isR2Path,
  type CleanupEntry,
} from "../supabase/functions/_shared/storage-paths";

const user = "11111111-1111-4111-8111-111111111111";
const application = "22222222-2222-4222-8222-222222222222";
const unrelated = "44444444-4444-4444-8444-444444444444";
const object = "33333333-3333-4333-8333-333333333333";
const legacyPath = `${user}/${application}/${object}.pdf`;
const r2Path = `r2/${user}/${application}/${object}.jpg`;

const entry = (path: string, overrides: Partial<CleanupEntry> = {}): CleanupEntry => ({
  bucket: "application-files",
  application_id: application,
  path,
  ...overrides,
});

describe("private applicant storage paths", () => {
  it("accepts only correctly structured R2 object keys", () => {
    expect(isR2Path(r2Path)).toBe(true);
    expect(isR2Path(`r2/${user}/${application}/${object}.png`)).toBe(true);
    expect(isR2Path(legacyPath)).toBe(false);
    expect(isR2Path(`r2/${user}/${application}/${object}.exe`)).toBe(false);
    expect(isR2Path(`r2/${user}/${application}/../${object}.pdf`)).toBe(false);
  });

  it("recognizes both private providers for matching application IDs", () => {
    expect(cleanupProvider(entry(r2Path))).toBe("r2");
    expect(cleanupProvider(entry(legacyPath))).toBe("supabase");
  });

  it("rejects unexpected buckets, cross-application paths, and malformed keys", () => {
    expect(cleanupProvider(entry(r2Path, { bucket: "public" }))).toBeNull();
    expect(cleanupProvider(entry(legacyPath, { application_id: unrelated }))).toBeNull();
    expect(cleanupProvider(entry(r2Path, { application_id: unrelated }))).toBeNull();
    expect(cleanupProvider(entry("r2/../../secret.pdf"))).toBeNull();
    expect(cleanupProvider(entry(`r2/${user}/${application}/${object}.svg`))).toBeNull();
    expect(cleanupProvider(entry(`/r2/${user}/${application}/${object}.pdf`))).toBeNull();
    expect(cleanupProvider(entry(`${user}/${application}/${object}.pdf/extra`))).toBeNull();
  });
});
