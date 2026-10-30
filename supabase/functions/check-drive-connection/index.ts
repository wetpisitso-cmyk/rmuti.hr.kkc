import { backend, corsFor, json } from "../_shared/helpers.ts";
import { checkDriveFolderAccess, driveEnabled } from "../_shared/google-drive.ts";

// Read-only service account connectivity diagnosis; only user_roles.admin can call.
// Never return credential details, tokens, folder contents or applicant records.
Deno.serve(async (req) => {
  let cors: Record<string,string> = {};
  try {
    cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
    if (req.method !== "POST") return json({error:"METHOD_NOT_ALLOWED"},405,cors);
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if (!jwt) return json({error:"UNAUTHORIZED"},401,cors);
    const admin = backend();
    const {data:{user},error:authError} = await admin.auth.getUser(jwt);
    if (!user || authError) return json({error:"UNAUTHORIZED"},401,cors);
    const {data:role,error:roleError} = await admin.from("user_roles")
      .select("role").eq("user_id",user.id).maybeSingle();
    if (roleError || role?.role !== "admin") return json({error:"FORBIDDEN"},403,cors);
    try {
      const folder = await checkDriveFolderAccess();
      return json({connected:folder === "ready",folder_status:folder,enabled:driveEnabled()},200,cors);
    } catch (e) {
      const codes = new Set([
        "GDRIVE_CREDENTIALS_MISSING","GDRIVE_CREDENTIALS_INVALID",
        "GDRIVE_FOLDER_NOT_CONFIGURED","GDRIVE_AUTH_FAILED",
        "GDRIVE_FOLDER_ACCESS_DENIED","GDRIVE_FOLDER_MISMATCH",
        "GDRIVE_CONNECTION_FAILED",
      ]);
      const code = e instanceof Error && codes.has(e.message) ? e.message : "GDRIVE_CONNECTION_FAILED";
      return json({connected:false,error:code,enabled:false},200,cors);
    }
  } catch {
    return json({error:"CHECK_FAILED"},500,cors);
  }
});
