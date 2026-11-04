// Server-only applicant mail worker. Never expose WORKER_SECRET or RESEND_API_KEY to Vite/GitHub Pages.
// POST with x-worker-secret; no cron until the agency approves the outbound provider.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  const secret = Deno.env.get("WORKER_SECRET") || "";
  if (secret.length < 32 || req.headers.get("x-worker-secret") !== secret)
    return response({ error: "UNAUTHORIZED" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response({ error: "BACKEND_NOT_CONFIGURED" }, 503);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: cfg, error: cfgErr } = await db.from("app_settings").select("value").eq("key", "applicant_mail").maybeSingle();
  if (cfgErr) return response({ error: "MAIL_CONFIG_UNAVAILABLE" }, 503);
  if (!cfg?.value?.enabled) return response({ ok: true, disabled: true, processed: 0 });
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!apiKey || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))
    return response({ error: "MAIL_PROVIDER_NOT_CONFIGURED", processed: 0 }, 503);
  const { data: jobs, error: claimError } = await db.rpc("claim_emails", { p_limit: 10 });
  if (claimError) return response({ error: "MAIL_CLAIM_FAILED" }, 503);

  let sent = 0, failed = 0;
  for (const job of jobs || []) {
    let ok = false;
    let code = "UNKNOWN";
    try {
      if (typeof job.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.email))
        throw new Error("INVALID_RECIPIENT");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
          "Idempotency-Key": job.id,
        },
        body: JSON.stringify({
          from, to: [job.email], subject: job.subject,
          text: job.body, tags: [{ name: "system", value: "rmuti_kkc_recruitment" }],
        }),
      });
      if (!res.ok) {
        code = "PROVIDER_HTTP_" + res.status;
      } else {
        const data = await res.json();
        ok = Boolean(data?.id);
        code = ok ? "" : "PROVIDER_NO_ID";
      }
    } catch (e) {
      code = e instanceof Error && e.message === "INVALID_RECIPIENT" ? "INVALID_RECIPIENT" : "DELIVERY_ERROR";
    }
    const { error: finishError } = await db.rpc("finish_email", {
      p_id: job.id, p_lease: job.lease_token, p_ok: ok, p_code: code,
    });
    if (finishError) return response({ error: "MAIL_FINISH_FAILED", processed: sent + failed }, 503);
    if (ok) sent++; else failed++;
  }
  return response({ ok: true, processed: sent + failed, sent, failed });
});
