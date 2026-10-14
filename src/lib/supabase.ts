import { createClient } from "@supabase/supabase-js";
import { parseRecovery } from "./recovery";
import { projectUrl, projectPublishableKey } from "./project-config";
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || projectUrl;
const url = supabaseUrl;
export const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || projectPublishableKey;
export const configured = Boolean(
  url &&
  publishableKey &&
  !url.includes("YOUR_PROJECT") &&
  !publishableKey.includes("REPLACE_ME"),
);
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  publishableKey || "placeholder",
  {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
export const baseUrl = () => window.location.origin + import.meta.env.BASE_URL;
export async function initializeRecovery() {
  const p = parseRecovery(window.location.href);
  if (!p.access && !p.code && !p.error) return;
  let error: string | null = p.error;
  try {
    if (p.access && p.refresh) {
      const r = await supabase.auth.setSession({
        access_token: p.access,
        refresh_token: p.refresh,
      });
      if (r.error) error = "ลิงก์หมดอายุหรือใช้งานไม่ได้ กรุณาขอลิงก์ใหม่";
    } else if (p.code) {
      const r = await supabase.auth.exchangeCodeForSession(p.code);
      if (r.error)
        error = "ไม่สามารถเปิดลิงก์นี้ได้ กรุณาขอลิงก์ใหม่จากเบราว์เซอร์นี้";
    }
  } catch {
    error = "ไม่สามารถตรวจสอบลิงก์ได้ กรุณาขอลิงก์ใหม่";
  }
  if (error)
    sessionStorage.setItem(
      "recovery-error",
      "ลิงก์หมดอายุหรือใช้งานไม่ได้ กรุณาขอลิงก์ใหม่",
    );
  // Remove token/query before mounting HashRouter. No token is printed or sent to analytics.
  window.history.replaceState(
    null,
    "",
    import.meta.env.BASE_URL +
      (error
        ? "#/forgot-password"
        : p.recovery
          ? "#/reset-password"
          : "#/dashboard"),
  );
}
