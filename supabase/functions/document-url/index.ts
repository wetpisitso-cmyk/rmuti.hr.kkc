import { backend, corsFor, json } from "../_shared/helpers.ts";
import { isR2Path, r2Config, signedR2Download } from "../_shared/r2.ts";

// Only the owner of an application or authorized staff may request a
// short-lived GET URL. R2 bucket stays private; URL expires after 120 seconds.
Deno.serve(async (req) => {
  let cors:Record<string,string>={};
  try {
    cors=corsFor(req);
    const headers={...cors,"Cache-Control":"no-store"};
    if(req.method==="OPTIONS")return new Response("ok",{headers});
    if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,headers);
    const jwt=req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if(!jwt)return json({error:"UNAUTHORIZED"},401,headers);
    const admin=backend();
    const {data:{user},error:authError}=await admin.auth.getUser(jwt);
    if(authError || !user)return json({error:"UNAUTHORIZED"},401,headers);
    if(Number(req.headers.get("content-length")||0)>2048)
      return json({error:"INVALID_INPUT"},400,headers);
    const body=await req.json();
    const path=typeof body?.path==="string"?body.path:"";
    if(!isR2Path(path))return json({error:"INVALID_FILE_PATH"},400,headers);
    const tables=[
      ["application_documents","storage_path"],
      ["application_document_versions","storage_path"],
      ["payment_records","slip_path"],
    ] as const;
    let applicationId:string|null=null;
    for(const [table,column] of tables){
      const {data,error}=await admin.from(table)
        .select("application_id").eq(column,path).maybeSingle();
      if(error)return json({error:"FILE_CHECK_FAILED"},503,headers);
      if(data?.application_id){applicationId=data.application_id;break;}
    }
    if(!applicationId)return json({error:"FILE_NOT_FOUND"},404,headers);
    const {data:application,error:appError}=await admin.from("applications")
      .select("user_id").eq("id",applicationId).maybeSingle();
    if(appError || !application)return json({error:"FILE_NOT_FOUND"},404,headers);
    if(application.user_id!==user.id){
      const {data:role,error:roleError}=await admin.from("user_roles")
        .select("role").eq("user_id",user.id).maybeSingle();
      if(roleError || !role || !["admin","hr"].includes(role.role))
        return json({error:"FORBIDDEN"},403,headers);
    }
    try {
      r2Config();
      const url=await signedR2Download(path);
      return json({url,expires_in:120},200,headers);
    } catch {
      return json({error:"R2_NOT_CONFIGURED"},503,headers);
    }
  }catch{
    return json({error:"FILE_CHECK_FAILED"},503,cors);
  }
});
