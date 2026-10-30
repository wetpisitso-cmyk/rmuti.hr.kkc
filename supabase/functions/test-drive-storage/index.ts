import { backend, corsFor, json } from "../_shared/helpers.ts";
import {
  checkDriveFolderAccess, uploadDrive, drivePath, readDrive, deleteDrive,
} from "../_shared/google-drive.ts";

// Admin-only synthetic file test. Never accesses real applicant documents.
// All Google Drive credentials remain inside Supabase Edge Function secrets.
const SMALL_TEST_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9jlS0AAAAASUVORK5CYII=";
const TEST_USER = "00000000-0000-4000-8000-000000000001";
const TEST_APPLICATION = "00000000-0000-4000-8000-000000000002";

Deno.serve(async (req) => {
  let cors: Record<string, string> = {};
  try {
    cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, cors);
    if (Number(req.headers.get("content-length") || 0) > 1024)
      return json({ error: "INVALID_INPUT" }, 413, cors);
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!jwt) return json({ error: "UNAUTHORIZED" }, 401, cors);
    const admin = backend();
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (!user || authError) return json({ error: "UNAUTHORIZED" }, 401, cors);
    const { data: role, error: roleError } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).maybeSingle();
    if (roleError || role?.role !== "admin")
      return json({ error: "FORBIDDEN" }, 403, cors);
    // Limits an authorized administrator to at most a few test uploads.
    const { data: allowed, error: limitError } = await admin.rpc("claim_rate", {
      p_scope: "gdrive_smoke", p_key: user.id, p_limit: 3,
    });
    if (limitError || !allowed) return json({ error: "RATE_LIMITED" }, 429, cors);

    let fileId: string | null = null;
    let uploaded = false;
    let readBack = false;
    let cleaned = false;
    let failure = "";
    try {
      const folder = await checkDriveFolderAccess();
      if (folder !== "ready") throw new Error("GDRIVE_FOLDER_WRITE_DENIED");
      const bytes = Uint8Array.from(atob(SMALL_TEST_PNG), (c) => c.charCodeAt(0));
      fileId = await uploadDrive(bytes, "image/png", "png");
      uploaded = true;
      const path = drivePath(TEST_USER, TEST_APPLICATION, fileId, "png");
      const returned = await readDrive(path);
      readBack = returned.byteLength === bytes.byteLength &&
        returned.every((byte, index) => byte === bytes[index]);
      if (!readBack) throw new Error("GDRIVE_CONTENT_MISMATCH");
    } catch (error) {
      // Do not leak provider responses (OAuth, object metadata, file names).
      const code = error instanceof Error ? error.message : "";
      const recognized = new Set([
        "GDRIVE_CREDENTIALS_MISSING", "GDRIVE_CREDENTIALS_INVALID",
        "GDRIVE_FOLDER_NOT_CONFIGURED", "GDRIVE_AUTH_FAILED",
        "GDRIVE_FOLDER_ACCESS_DENIED", "GDRIVE_FOLDER_MISMATCH",
        "GDRIVE_CONNECTION_FAILED", "GDRIVE_FOLDER_WRITE_DENIED",
        "GDRIVE_UPLOAD_FAILED", "GDRIVE_UPLOAD_INVALID",
        "GDRIVE_UPLOAD_VERIFICATION_FAILED", "GDRIVE_FILE_NOT_FOUND",
        "GDRIVE_FILE_INVALID", "GDRIVE_DOWNLOAD_FAILED",
        "GDRIVE_CONTENT_MISMATCH",
      ]);
      failure = recognized.has(code) ? code : "GDRIVE_SMOKE_FAILED";
    } finally {
      if (fileId) {
        try {
          // Content Manager: moves the synthetic test image to trash.
          // This is NOT permanent deletion.
          await deleteDrive(fileId);
          cleaned = true;
        } catch {
          // Report cleanup failure so the admin can remove the test object.
          cleaned = false;
        }
      }
    }
    const passed = uploaded && readBack && cleaned;
    return json({
      ok: passed, uploaded, read_back: readBack, moved_to_trash: cleaned,
      error: passed ? null : failure || "GDRIVE_TEST_CLEANUP_FAILED",
      note: "Synthetic 1-pixel PNG only; no applicant document accessed",
    }, 200, cors);
  } catch {
    return json({ error: "GDRIVE_SMOKE_FAILED" }, 500, cors);
  }
});
