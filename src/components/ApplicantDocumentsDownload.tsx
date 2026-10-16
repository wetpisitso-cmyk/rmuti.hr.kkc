import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { downloadApplicantDocumentsPdf } from "../lib/applicant-documents-pdf";
import { errorTH } from "../lib/errors";
import { useAuth } from "../hooks/useAuth";
export default function ApplicantDocumentsDownload({ applicationId, compact=false }: {applicationId:string;compact?:boolean}) {
 const auth=useAuth();
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState("");
 const [error,setError]=useState("");
 if(auth.role!=="admin")return null;
 return <div className={compact?"stack gap-1":"stack gap-2"}>
  <button type="button" className="btn small outline no-print" disabled={busy} onClick={async()=>{
   setBusy(true);setError("");setProgress("");
   try{await downloadApplicantDocumentsPdf(applicationId,setProgress);}
   catch(e){setError(errorTH(e));}
   finally{setBusy(false);setProgress("");}
  }}>
   {busy?<LoaderCircle size={16} className="animate-spin"/>:<Download size={16}/>}
   {busy?"กำลังจัดทำ PDF…":"ดาวน์โหลดเอกสารทั้งหมด (PDF)"}
  </button>
  {busy&&progress&&<small role="status" className="muted">{progress}</small>}
  {error&&<small role="alert" className="error-text">{error}</small>}
 </div>;
}
