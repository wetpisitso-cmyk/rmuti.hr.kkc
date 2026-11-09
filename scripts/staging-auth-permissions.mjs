import { createClient } from "@supabase/supabase-js";

// Read-only authorization smoke against an isolated staging Supabase project.
// Never sign in to real applicant accounts, send mail, or mutate applicant data.
const url = process.env.STAGING_SUPABASE_URL || "";
const key = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "";
const aEmail = process.env.STAGING_APPLICANT_A_EMAIL || "";
const aPassword = process.env.STAGING_APPLICANT_A_PASSWORD || "";
const bEmail = process.env.STAGING_APPLICANT_B_EMAIL || "";
const bPassword = process.env.STAGING_APPLICANT_B_PASSWORD || "";
const expectedRef = process.env.STAGING_PROJECT_REF || "";
const productionRef = "rioukmxrgaknayltxxyk";
if (!expectedRef || expectedRef === productionRef || !url.includes(expectedRef) ||
    !url.startsWith("https://") || !key ||
    !aEmail || !aPassword || !bEmail || !bPassword || aEmail === bEmail) {
  throw new Error("STAGING_E2E_REFUSED: separate staging project and two fixture applicants required");
}
function client() {
  return createClient(url, key, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
}
const a = client(), b = client();
const [ar,br] = await Promise.all([
  a.auth.signInWithPassword({ email:aEmail,password:aPassword }),
  b.auth.signInWithPassword({ email:bEmail,password:bPassword }),
]);
if (ar.error || br.error || !ar.data.user || !br.data.user)
  throw new Error("STAGING_FIXTURE_LOGIN_FAILED");
if (ar.data.user.id === br.data.user.id)
  throw new Error("STAGING_USERS_NOT_DISTINCT");

async function check(name, fn) {
  await fn();
  process.stdout.write("PASS " + name + "\n");
}
await check("A can read only own application records", async()=>{
  const own=await a.from("applications").select("id,user_id").limit(10);
  if(own.error || own.data.some(x=>x.user_id!==ar.data.user.id))
    throw new Error("A_APPLICATION_ISOLATION_FAILED");
});
await check("B cannot see A applications", async()=>{
  const bView=await b.from("applications").select("id").eq("user_id",ar.data.user.id);
  if(bView.error || bView.data.length>0)throw new Error("B_READ_A_APPLICATIONS");
});
await check("A cannot see B applications", async()=>{
  const aView=await a.from("applications").select("id").eq("user_id",br.data.user.id);
  if(aView.error || aView.data.length>0)throw new Error("A_READ_B_APPLICATIONS");
});
await check("Both applicants cannot read staff notes", async()=>{
  for(const app of [a,b]){
    const x=await app.from("staff_notes").select("id").limit(1);
    if(!x.error && x.data.length)throw new Error("STAFF_NOTES_EXPOSED");
  }
});
await check("Applicant sessions cannot call privileged admin RPC", async()=>{
  for(const app of [a,b]){
    // Read-only admin RPC must always return FORBIDDEN for applicants.
    const x=await app.rpc("admin_get_own_username");
    if(!x.error || !String(x.error.message).includes("FORBIDDEN"))
      throw new Error("PRIVILEGED_ADMIN_RPC_GUARD_FAILED");
  }
});
await Promise.all([a.auth.signOut(),b.auth.signOut()]);
process.stdout.write("PASS staging-only read/permission smoke. No applicant rows modified.\n");
