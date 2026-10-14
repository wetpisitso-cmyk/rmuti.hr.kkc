import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../src/lib/project-config.ts", import.meta.url),
  "utf8",
);
const url =
  process.env.VITE_SUPABASE_URL || source.match(/projectUrl='([^']+)'/)[1];
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  JSON.parse(source.match(/projectPublishableKey=("[^"]+")/)[1]);
const headers = { apikey: key };
let passed = 0;
async function check(label, fn) {
  await fn();
  passed++;
  console.log("PASS", label);
}
const settings = await fetch(`${url}/auth/v1/settings`, { headers }).then((r) =>
  r.json(),
);
await check("Email/password provider enabled", () => {
  if (!settings.external?.email) throw Error("Email provider disabled");
});
console.log(
  "Confirm Email setting:",
  settings.mailer_autoconfirm
    ? "disabled — immediate signup ready"
    : "enabled — owner must disable before immediate signup",
);
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await check("Public positions API and relationship query", async () => {
  const t = performance.now();
  const r = await db
    .from("job_positions")
    .select("id,title,departments(name),recruitment_rounds(name)")
    .limit(10);
  if (r.error) throw r.error;
  console.log("Public query elapsed (ms):", Math.round(performance.now() - t));
});
await check("Public contact/privacy settings readable", async () => {
  const r = await db.from("app_settings").select("key");
  if (r.error || !r.data.some((x) => x.key === "privacy"))
    throw r.error || Error("Missing privacy setting");
});
await check("Anonymous applicant list denied", async () => {
  const r = await db.from("applications").select("id").limit(1);
  if (!r.error) throw Error("Unexpected anonymous table privilege");
});
await check("Anonymous privileged RPC denied", async () => {
  const r = await db.rpc("set_role", {
    p_user: crypto.randomUUID(),
    p_role: "admin",
    p_permissions: [],
  });
  if (!r.error) throw Error("Privileged RPC accepted");
});
await check("Upload function rejects missing JWT", async () => {
  const r = await fetch(`${url}/functions/v1/upload-document`, {
    method: "POST",
    headers: { ...headers, Origin: "https://wetpisitso-cmyk.github.io" },
  });
  if (r.status !== 401) throw Error(`Expected 401, got ${r.status}`);
});
const worker = await fetch(`${url}/functions/v1/email-worker`, {
  method: "POST",
  headers,
});
if (worker.status === 404)
  console.log(
    "SKIP Email worker — deployment awaits explicit provider approval",
  );
else
  await check("Email worker rejects missing worker secret", () => {
    if (worker.status !== 401)
      throw Error(`Expected 401, got ${worker.status}`);
  });
console.log(
  `${passed} API checks passed. No email was sent and no user/application was created.`,
);
