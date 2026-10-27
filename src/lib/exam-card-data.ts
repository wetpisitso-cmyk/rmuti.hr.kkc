import { rpc, signedFile } from "../services/api";

export interface ExamCardRecord {
 assignment_id:string;
 application_id:string;
 exam_number:string;
 name:string;
 job_title:string;
 department:string;
 issue_label:string;
 year_be:number;
 round_name:string;
 photo_path:string;
 signature_png:string;
 signer_name:string;
 issued_at:string;
}
export interface ExamCardListing {
 assignment_id:string;application_id:string;application_number:string|null;
 exam_number:string;applicant_name:string;job_id:string;job_title:string;department_id:string;department:string;
 round_id:string;round_name:string;year_be:number;issue_label:string;
 issued_at:string|null;revoked_at:string|null;card_current:boolean;rules_approved:boolean;has_photo:boolean;
 has_signature:boolean;schedule_published:boolean;status:string;
}
export async function fetchExamCard(assignmentId:string):Promise<ExamCardRecord>{
 return rpc<ExamCardRecord>("exam_card_info",{p_assignment:assignmentId});
}
export async function getExamCardPhoto(path:string):Promise<string>{
 if(!path)throw Error("APPLICANT_PHOTO_REQUIRED");
 const url=await signedFile(path);
 const response=await fetch(url,{cache:"no-store"});
 if(!response.ok)throw Error("PHOTO_DOWNLOAD_FAILED");
 const mime=response.headers.get("content-type")||"";
 if(!mime.startsWith("image/"))throw Error("INVALID_PHOTO");
 const blob=await response.blob();
 if(blob.size>8*1024*1024)throw Error("PHOTO_TOO_LARGE");
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result));
  reader.onerror=()=>reject(Error("PHOTO_READ_FAILED"));
  reader.readAsDataURL(blob);
 });
}
export async function examCardForExport(id:string) {
 const card=await fetchExamCard(id);
 const photo=await getExamCardPhoto(card.photo_path);
 return {card,photo};
}
