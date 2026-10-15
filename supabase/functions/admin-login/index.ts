// Supabase Edge Function: Admin username/password entry point.
// The password stays in Supabase Auth; the username mapping and Admin role
// are checked SERVER-SIDE. Never place the service-role key in the browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

const trustedOrigins = new Set([
  "https://wetpisitso-cmyk.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const encoder = new TextEncoder();
function response(req: Request, body: object, status: number) {
  const origin = req.headers.get("origin");
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin && trustedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}
async function keyFor(value: string) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(serviceKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, {}, 204);
  if (req.method !== "POST") return response(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !trustedOrigins.has(origin)) return response(req, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!url || !serviceKey || !publishableKey) {
    return response(req, { error: "SERVICE_UNAVAILABLE" }, 503);
  }
  const size = Number(req.headers.get("content-length") || "0");
  if (size > 4096) return response(req, { error: "INVALID_INPUT" }, 400);

  let username: string, password: string;
  try {
    const json = await req.json();
    username = typeof json.username === "string" ? json.username.trim().toLowerCase() : "";
    password = typeof json.password === "string" ? json.password : "";
  } catch {
    return response(req, { error: "INVALID_INPUT" }, 400);
  }
  if (!/^[a-z][a-z0-9._-]{3,31}$/.test(username) || !password || password.length > 256) {
    return response(req, { error: "INVALID_ADMIN_CREDENTIALS" }, 401);
  }
  try {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 128);
    // Two rate limits. Stored keys are HMACs; no raw IP, username or password in the database.
    const [ipKey, userKey] = await Promise.all([
      keyFor("ip|" + ip),
      keyFor("username|" + username),
    ]);
    const [ipLimit, userLimit] = await Promise.all([
      admin.rpc("edge_admin_login_limit", { p_key: ipKey, p_max_attempts: 45 }),
      admin.rpc("edge_admin_login_limit", { p_key: userKey, p_max_attempts: 12 }),
    ]);
    if (ipLimit.error || userLimit.error) return response(req, { error: "SERVICE_UNAVAILABLE" }, 503);
    if (!ipLimit.data || !userLimit.data) {
      return response(req, { error: "ADMIN_LOGIN_RATE_LIMITED" }, 429);
    }
    const lookup = await admin.from("admin_usernames").select("user_id")
      .eq("username", username).maybeSingle();
    if (lookup.error) return response(req, { error: "SERVICE_UNAVAILABLE" }, 503);
    if (!lookup.data) return response(req, { error: "INVALID_ADMIN_CREDENTIALS" }, 401);

    const role = await admin.from("user_roles").select("role")
      .eq("user_id", lookup.data.user_id).maybeSingle();
    if (role.error) return response(req, { error: "SERVICE_UNAVAILABLE" }, 503);
    if (role.data?.role !== "admin") return response(req, { error: "INVALID_ADMIN_CREDENTIALS" }, 401);

    const account = await admin.auth.admin.getUserById(lookup.data.user_id);
    if (account.error || !account.data.user?.email) {
      return response(req, { error: "INVALID_ADMIN_CREDENTIALS" }, 401);
    }
    const auth = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await auth.auth.signInWithPassword({
      email: account.data.user.email,
      password,
    });
    if (login.error || !login.data.session || login.data.user?.id !== lookup.data.user_id) {
      return response(req, { error: "INVALID_ADMIN_CREDENTIALS" }, 401);
    }
    // Confirm the role again before issuing the session (role might have been changed).
    const finalRole = await admin.from("user_roles").select("role")
      .eq("user_id", login.data.user.id).single();
    if (finalRole.error || finalRole.data?.role !== "admin") {
      return response(req, { error: "INVALID_ADMIN_CREDENTIALS" }, 401);
    }
    return response(req, {
      access_token: login.data.session.access_token,
      refresh_token: login.data.session.refresh_token,
    }, 200);
  } catch {
    // Intentionally do not log credentials or disclose whether the username exists.
    return response(req, { error: "SERVICE_UNAVAILABLE" }, 503);
  }
});
