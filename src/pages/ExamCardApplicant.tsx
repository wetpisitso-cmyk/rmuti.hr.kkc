import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { State,Notice,Title } from "../components/UI";
import { examCardForExport } from "../lib/exam-card-data";
import { makeExamCardPdf,downloadExamCard } from "../lib/exam-card-pdf";
import { errorTH } from "../lib/errors";

export default function ExamCardApplicant(){
 const {id,assignmentId}=useParams();
 const auth=useAuth();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const q=useQuery({queryKey:["exam-card",id,assignmentId,auth.session?.user.id],
  queryFn:()=>examCardForExport(assignmentId!),enabled:!!id&&!!assignmentId&&!!auth.session,staleTime:0,retry:false});
 async function download(){
  if(!assignmentId)return;
  setBusy(true);setError("");
  try{
   // Re-fetch authorization and card details at download time, rather than trusting a cached preview.
   const item=await examCardForExport(assignmentId);
   if(item.card.application_id!==id)throw Error("CARD_APPLICATION_MISMATCH");
   const pdf=await makeExamCardPdf([item]);
   const safe=item.card.exam_number.replace(/[^a-zA-Z0-9ก-๙_-]/g,"-");
   downloadExamCard(pdf,"ExamCard_"+safe+".pdf");
  }catch(e){setError(errorTH(e));}finally{setBusy(false);}
 }
 return <div className="container section">
  <Title title="บัตรประจำตัวผู้สมัครสอบ" description="ดาวน์โหลดได้เมื่อผ่านคุณสมบัติและเจ้าหน้าที่อนุมัติออกบัตรแล้ว"/>
  {error&&<Notice kind="error">{error}</Notice>}
  <State loading={q.isPending} error={q.error}>
   {q.data?.card.application_id!==id?<Notice>ไม่พบข้อมูลบัตรสำหรับใบสมัครนี้</Notice>:
    <section className="panel stack">
     <h2>มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น</h2>
     <h3>{q.data?.card.issue_label}</h3>
     <p><strong>เลขที่ประจำตัวสอบ:</strong> {q.data.card.exam_number}</p>
     <p><strong>ชื่อ–นามสกุล:</strong> {q.data.card.name}</p>
     <p><strong>ตำแหน่งที่สมัคร:</strong> {q.data.card.job_title}</p>
     <p><strong>สังกัดที่สมัคร:</strong> {q.data.card.department}</p>
     <p className="muted">บัตรมีรูปถ่าย ลายเซ็นเจ้าหน้าที่ และข้อปฏิบัติสำหรับเข้าสอบในเอกสาร PDF A4</p>
     <button type="button" className="btn primary" disabled={busy} onClick={()=>void download()}>
      {busy?"กำลังสร้างบัตรสอบ…":"ดาวน์โหลดบัตรสอบ PDF (A4)"}
     </button>
    </section>}
  </State>
  <Link to={id?"/application/"+id:"/dashboard"} className="btn outline">กลับหน้าใบสมัคร</Link>
 </div>;
}
