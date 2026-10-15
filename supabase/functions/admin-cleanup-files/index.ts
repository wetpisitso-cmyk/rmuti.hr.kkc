import { backend, corsFor, json } from "../_shared/helpers.ts";
import { deleteR2, isR2Path } from "../_shared/r2.ts";

// Drain the existing durable file-cleanup queue after an Admin deletes
// an application. Legacy Supabase objects and new R2 objects are supported.
Deno.serve(async (req) => {
  let cors:Record<string,string>={};
  try{
    cors=corsFor(req);
    if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
    if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,cors);
    const jwt=req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if(!jwt)return json({error:"UNAUTHORIZED"},401,cors);
    const admin=backend();
    const {data:{user},error:authError}=await admin.auth.getUser(jwt);
    if(authError || !user)return json({error:"UNAUTHORIZED"},401,cors);
    const {data:role,error:roleError}=await admin.from("user_roles")
      .select("role").eq("user_id",user.id).maybeSingle();
    if(roleError || role?.role!=="admin")return json({error:"FORBIDDEN"},403,cors);
    const {data:items,error:queueError}=await admin.from("application_file_cleanup_queue")
      .select("bucket,path,application_id").order("queued_at",{ascending:true}).limit(100);
    if(queueError)return json({error:"QUEUE_FAILED"},500,cors);
    let cleaned=0,failed=0;
    for(const item of items||[]){
      // Validates the application prefix to prevent a corrupted cleanup entry
      // from deleting unrelated data.
      const belongs=item.path.includes("/"+item.application_id+"/");
      const validBucket=item.bucket==="application-files";
      const isR2=item.path.startsWith("r2/");
      const validPath=isR2?isR2Path(item.path):
        /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(item.path);
      if(!belongs || !validBucket || !validPath){failed++;continue;}
      try{
        if(isR2){
          // Even when new R2 writes are disabled, old R2 files still require cleanup.
          // Deletion fails safely if the R2 secrets have been removed.
          await deleteR2(item.path);
        }else{
          const {error}=await admin.storage.from("application-files").remove([item.path]);
          if(error){failed++;continue;}
        }
        const {error}=await admin.from("application_file_cleanup_queue")
          .delete().eq("bucket",item.bucket).eq("path",item.path);
        if(error)failed++;else cleaned++;
      }catch{failed++;}
    }
    return json({cleaned,failed,remaining:(items||[]).length-cleaned},failed?207:200,cors);
  }catch{return json({error:"QUEUE_FAILED"},500,cors);}
});
