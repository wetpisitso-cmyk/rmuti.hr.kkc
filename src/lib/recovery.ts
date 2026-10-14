export interface RecoveryData {
  access: string | null;
  refresh: string | null;
  code: string | null;
  error: string | null;
  recovery: boolean;
}
export function parseRecovery(href: string): RecoveryData {
  const u = new URL(href),
    fragment = u.hash.startsWith("#/")
      ? new URLSearchParams()
      : new URLSearchParams(u.hash.slice(1));
  return {
    access: fragment.get("access_token"),
    refresh: fragment.get("refresh_token"),
    code: u.searchParams.get("code"),
    error:
      fragment.get("error_description") ||
      u.searchParams.get("error_description"),
    recovery:
      fragment.get("type") === "recovery" ||
      u.searchParams.get("auth") === "recovery",
  };
}
