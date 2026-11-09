import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const workflow = readFileSync(".github/workflows/backup-database.yml","utf8");
const script = readFileSync("scripts/backup-database.sh","utf8");
const restore = readFileSync("scripts/restore-staging-only.sh","utf8");

describe("safe backup and restoration contract", () => {
  it("does not run without explicit operational enablement", () => {
    expect(workflow).toContain("vars.RMUTI_BACKUP_ENABLED == 'true'");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).toContain("schedule:");
  });
  it("encrypts before uploading, and checks the archive and remote copy", () => {
    expect(script.indexOf("pg_dump")).toBeLessThan(script.indexOf("age -r"));
    expect(script.indexOf("age -r")).toBeLessThan(script.indexOf("rclone copyto"));
    expect(script).toContain("pg_restore --list");
    expect(script).toContain("rclone check");
    expect(script).not.toContain("echo \"$BACKUP_DATABASE_URL\"");
  });
  it("refuses production restore and requires staging confirmation", () => {
    expect(restore).toContain("rioukmxrgaknayltxxyk");
    expect(restore).toContain("RESTORE_ISOLATED_STAGING_ONLY");
    expect(restore).toContain("STAGING_PROJECT_REF");
  });
  it("both shell scripts parse and fail safely when not configured", () => {
    if (process.platform === "win32") return;
    for(const file of ["scripts/backup-database.sh","scripts/restore-staging-only.sh"]) {
      const syntax=spawnSync("bash",["-n",file],{encoding:"utf8"});
      expect(syntax.status,syntax.stderr).toBe(0);
      const noSecrets=spawnSync("bash",[file],{
        encoding:"utf8",
        env:{PATH:process.env.PATH || ""},
      });
      expect(noSecrets.status).not.toBe(0);
    }
  });
});
