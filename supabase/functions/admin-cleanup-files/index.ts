import { backend, corsFor, json } from "../_shared/helpers.ts";

// Drain Supabase Storage cleanup queue only, verifying every object path.
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
      if(item.bucket!=="application-files" || !new RegExp("^[0-9a-f-]{36}/"+item.application_id+"/[0-9a-f-]{36}\\.(pdf|jpg|png)$").test(item.path)){failed++;continue;}
      try{
        const {error}=await admin.storage.from("application-files").remove([item.path]);
        if(error){failed++;continue;}
        const {error}=await admin.from("application_file_cleanup_queue")
          .delete().eq("bucket",item.bucket).eq("path",item.path);
        if(error)failed++;else cleaned++;
      }catch{failed++;}
    }
    return json({cleaned,failed,remaining:(items||[]).length-cleaned},failed?207:200,cors);
  }catch{return json({error:"QUEUE_FAILED"},500,cors);}
});
