import { backend, corsFor, json, sniff } from "../_shared/helpers.ts";
import { r2Enabled, r2Config, uploadR2, deleteR2 } from "../_shared/r2.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

// Preserve the original authenticated upload path and its validation.
// New uploads go to private R2 only when R2_ENABLED=true and secrets are valid.
// Otherwise keep Supabase Storage so the live system remains operational.
Deno.serve(async (req) => {
  let cors: Record<string,string> = {};
  try {
    cors = corsFor(req);
    if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
    if(req.method!=="POST") return json({error:"METHOD_NOT_ALLOWED"},405,cors);
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if(!jwt) return json({error:"UNAUTHORIZED"},401,cors);
    const admin=backend();
    const {data:{user},error:authError}=await admin.auth.getUser(jwt);
    if(authError || !user) return json({error:"UNAUTHORIZED"},401,cors);
    const {data:rate,error:rateError}=await admin.rpc("claim_rate",{
      p_scope:"upload",p_key:user.id,p_limit:15
    });
    if(rateError || !rate) return json({error:"RATE_LIMITED"},429,cors);
    if(Number(req.headers.get("content-length")||0)>4*1048576)
      return json({error:"FILE_TOO_LARGE"},413,cors);

    // Fail closed: never silently fall back if R2 is explicitly enabled but misconfigured.
    if(r2Enabled()) {
      // Do not allow R2 writes until reviewed R2 deletion and retention workflow is live.
      if(Deno.env.get("R2_CLEANUP_READY")!=="true")
        return json({error:"R2_CLEANUP_NOT_ENABLED"},503,cors);
      try {r2Config()}catch{return json({error:"R2_NOT_CONFIGURED"},503,cors);}
    }

    const form=await req.formData();
    const id=String(form.get("application_id")||"");
    const type=String(form.get("document_type")||"");
    const file=form.get("file");
    if(!(file instanceof File) || !/^[0-9a-f-]{36}$/i.test(id) ||
       !/^[a-z][a-z0-9_]{0,39}$/.test(type))
      return json({error:"INVALID_INPUT"},400,cors);
    const scoped=createClient(Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,{
      global:{headers:{Authorization:"Bearer "+jwt}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:limit,error:denied}=await scoped.rpc("check_upload",{p_id:id,p_type:type});
    if(denied) return json({error:denied.message},403,cors);
    if(file.size<1 || file.size>Math.min(Number(limit.max_bytes),3*1048576))
      return json({error:"FILE_TOO_LARGE"},400,cors);
    const bytes=new Uint8Array(await file.arrayBuffer());
    const mime=sniff(bytes);
    if(!mime || file.type!==mime || (type==="photo" && mime==="application/pdf"))
      return json({error:"INVALID_FILE"},400,cors);
    const ext=mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg";
    const useR2=r2Enabled();
    const path=(useR2?"r2/":"")+user.id+"/"+id+"/"+crypto.randomUUID()+"."+ext;
    if(useR2) {
      try {
        await uploadR2(path,bytes,mime);
      }catch {
        return json({error:"R2_UPLOAD_FAILED"},502,cors);
      }
    } else {
      const {error}=await admin.storage.from("application-files")
        .upload(path,bytes,{contentType:mime,upsert:false});
      if(error) return json({error:"UPLOAD_FAILED"},500,cors);
    }
    const rpc=useR2?"complete_r2_upload":"complete_upload";
    const {data,error}=await admin.rpc(rpc,{
      p_user:user.id,p_id:id,p_type:type,p_path:path,
      p_name:file.name,p_mime:mime,p_size:file.size
    });
    if(error) {
      // Roll back only the fresh object, never the applicant's existing file.
      try {
        if(useR2) await deleteR2(path);
        else await admin.storage.from("application-files").remove([path]);
      } catch { /* preserve original failure code */ }
      return json({error:error.message},409,cors);
    }
    // Previous revisions and signed application snapshots remain private/readable.
    return json({document_id:data.document_id,provider:useR2?"r2":"supabase"},200,cors);
  }catch {
    return json({error:"UPLOAD_FAILED"},500,cors);
  }
});
