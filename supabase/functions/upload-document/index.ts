import { backend, corsFor, json, sniff } from "../_shared/helpers.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { b2Enabled, uploadB2, removeB2 } from "../_shared/b2.ts";
import { driveEnabled, uploadDrive, deleteDrive, drivePath } from "../_shared/google-drive.ts";

// Supabase remains default. B2 opt-in is enabled only after SQL, read proxy and secrets are verified.
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
    const usingDrive = driveEnabled();
    const usingB2 = !usingDrive && b2Enabled();
    let driveFileId: string | null = null;
    let path: string;
    if (usingDrive) {
      // Upload only through the authenticated server. Store a short opaque
      // reference in the DB, never a public Drive URL or credential.
      try {
        driveFileId = await uploadDrive(bytes, mime, ext);
        path = drivePath(user.id, id, driveFileId, ext);
      } catch {
        return json({error:"GDRIVE_UPLOAD_FAILED"},502,cors);
      }
    } else {
      path = user.id+"/"+id+"/"+(usingB2?"b2/":"")+crypto.randomUUID()+"."+ext;
      if(usingB2){
        try { await uploadB2(path,bytes,mime); }
        catch { return json({error:"UPLOAD_FAILED"},502,cors); }
      } else {
        const {error:uploadError}=await admin.storage.from("application-files")
          .upload(path,bytes,{contentType:mime,upsert:false});
        if(uploadError)return json({error:"UPLOAD_FAILED"},500,cors);
      }
    }
    const rpcName = usingDrive ? "complete_gdrive_upload" :
      usingB2 ? "complete_b2_upload" : "complete_upload";
    const {data,error}=await admin.rpc(rpcName,{
      p_user:user.id,p_id:id,p_type:type,p_path:path,
      p_name:file.name,p_mime:mime,p_size:file.size
    });
    if(error) {
      // Roll back only a new object. Do NOT delete the prior document/version.
      try {
        if(usingDrive && driveFileId) await deleteDrive(driveFileId);
        else if(usingB2) await removeB2(path);
        else await admin.storage.from("application-files").remove([path]);
      } catch { /* log orphan for administrator cleanup */ }
      return json({error:error.message},409,cors);
    }
    return json({document_id:data.document_id,provider:
      usingDrive?"gdrive":usingB2?"b2":"supabase"},200,cors);
  }catch {
    return json({error:"UPLOAD_FAILED"},500,cors);
  }
});
