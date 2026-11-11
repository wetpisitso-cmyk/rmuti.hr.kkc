import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("retired applicant email worker remains disabled", () => {
  const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../supabase/functions/applicant-email-worker/index.ts", import.meta.url), "utf8");
  it("requires gateway JWT authentication on the retired endpoint", () => {
    expect(config).toMatch(/\[functions\.applicant-email-worker\]\s*verify_jwt\s*=\s*true/);
  });
  it("returns a retired response without referencing the old mail queue or mail provider", () => {
    expect(worker).toContain("EMAIL_NOTIFICATIONS_RETIRED");
    expect(worker).toContain("status: 410");
    expect(worker).not.toMatch(/Resend|sendgrid|SMTP|claim_emails|finish_email|email_outbox/i);
  });
});
