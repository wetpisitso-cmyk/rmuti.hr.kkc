import { backend, corsFor, json } from "../_shared/helpers.ts";
import { parseDrivePath, readDrive } from "../_shared/google-drive.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

// All downloads are proxied through a user-authenticated and RLS-checked
// endpoint. Never return Google URLs or service-account credentials.
Deno.serve(async (req) => {
  let cors: Record<string, string> = {};
  try {
    cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, cors);
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!jwt) return json({ error: "UNAUTHORIZED" }, 401, cors);
    const admin = backend();
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (!user || authError) return json({ error: "UNAUTHORIZED" }, 401, cors);
    if (Number(req.headers.get("content-length") || 0) > 2048) {
      return json({ error: "INVALID_INPUT" }, 413, cors);
    }
    const body = await req.json();
    if (!body || typeof body.path !== "string" || body.path.length > 512) {
      return json({ error: "INVALID_INPUT" }, 400, cors);
    }
    const path: string = body.path;
    parseDrivePath(path);
    const scoped = createClient(Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: "Bearer " + jwt } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const [current, versions] = await Promise.all([
      scoped.from("application_documents").select("id").eq("storage_path", path).maybeSingle(),
      scoped.from("application_document_versions").select("id").eq("storage_path", path).maybeSingle(),
    ]);
    if (current.error || versions.error) return json({ error: "FILE_CHECK_FAILED" }, 500, cors);
    if (!current.data && !versions.data) return json({ error: "FORBIDDEN" }, 403, cors);
    const bytes = await readDrive(path);
    const ext = parseDrivePath(path).ext;
    const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors, "Content-Type": mime, "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "INVALID_DRIVE_PATH";
    return json({ error: invalid ? "INVALID_INPUT" : "FILE_DOWNLOAD_FAILED" },
      invalid ? 400 : 500, cors);
  }
});
