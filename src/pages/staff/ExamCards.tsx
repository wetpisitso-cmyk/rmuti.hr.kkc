import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCatalog } from "../../hooks/useCatalog";
import { rpc } from "../../services/api";
import { errorTH } from "../../lib/errors";
import { State,Notice,Title,Select,Field } from "../../components/UI";
import { examCardForExport, type ExamCardListing } from "../../lib/exam-card-data";
import { makeExamCardPdf,downloadExamCard } from "../../lib/exam-card-pdf";
export default function ExamCards() {
 const auth=useAuth(),catalog=useCatalog(),qc=useQueryClient();
 const [round,setRound]=useState(""),[job,setJob]=useState(""),[label,setLabel]=useState("ครั้งที่ 40 / 2569");
 const [busy,setBusy]=useState(""),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const records=useQuery({queryKey:["exam-card-list",round],enabled:auth.can("exams"),
  queryFn:()=>rpc<ExamCardListing[]>("exam_card_list",{p_round:round||null})});
 const shown=(records.data||[]).filter(r=>!job||r.job_title===job);
 async function operate(fn:()=>Promise<unknown>,name:string) {
  setBusy(name);setError("");setSuccess("");
  try {await fn();await qc.invalidateQueries({queryKey:["exam-card-list"]});setSuccess("ดำเนินการเรียบร้อย");}
  catch(e){setError(errorTH(e));}finally{setBusy("");}
 }
 async function exportPdf(ids:string[]){
  await operate(async()=>{
   const cards=[];
   for(const id of ids) cards.push(await examCardForExport(id));
   const pdf=await makeExamCardPdf(cards);
   const safe=ids.length===1?cards[0].card.exam_number.replace(/[^a-zA-Z0-9ก-๙_-]/g,"-"):"batch-"+ids.length;
   downloadExamCard(pdf,"ExamCard_"+safe+".pdf");
  },"pdf");
 }
 if(!auth.can("exams"))return <Notice kind="error">ไม่มีสิทธิ์จัดการบัตรสอบ</Notice>;
 return <div className="container section">
  <Title eyebrow="EXAM ADMISSION CARD" title="จัดการบัตรประจำตัวผู้สมัครสอบ"
   description="ใช้ข้อมูลผู้สมัคร รูปถ่าย เลขสอบ และลายเซ็นจากระบบเดิม ออกเป็น PDF A4 แนวตั้ง"/>
  {error&&<Notice kind="error">{error}</Notice>}
  {success&&<Notice kind="success">{success}</Notice>}
  <section className="panel stack">
   <div className="form-grid">
    <Select label="รอบรับสมัคร" value={round} onChange={e=>{
     const id=e.target.value;setRound(id);setJob("");setSelected([]);
     setLabel(records.data?.find(r=>r.round_id===id)?.issue_label||"ครั้งที่ 40 / 2569");
    }}><option value="">ทุกรอบ</option>
     {catalog.rounds.data?.map(r=><option key={r.id} value={r.id}>{r.name} · {r.year_be}</option>)}
    </Select>
    <Select label="ตำแหน่ง" value={job} onChange={e=>{setJob(e.target.value);setSelected([]);}}>
     <option value="">ทุกตำแหน่ง</option>
     {Array.from(new Set(records.data?.map(r=>r.job_title)||[])).map(t=><option key={t}>{t}</option>)}
    </Select>
   </div>
   {auth.role==="admin"&&round&&<div className="flex gap-2 flex-wrap items-end">
    <Field label="ครั้งที่สอบ (เปลี่ยนได้)" value={label} maxLength={100} onChange={e=>setLabel(e.target.value)}/>
    <button className="btn primary" type="button" disabled={!!busy} onClick={()=>void operate(
     ()=>rpc("admin_exam_card_set_round",{p_round:round,p_label:label}),"round")}>บันทึกครั้งที่สอบ</button>
   </div>}
   <p className="muted">ต้องมีสถานะผ่านคุณสมบัติ กำหนดสอบเผยแพร่ รูปถ่าย ลายเซ็นเจ้าหน้าที่ และการอนุมัติ PDF เดิมครบก่อนออกบัตรสอบ</p>
  </section>
  <section className="panel stack">
   <div className="flex justify-between flex-wrap gap-2">
    <h2>รายชื่อผู้มีสิทธิสอบ ({shown.length})</h2>
    <button className="btn outline" type="button"
     disabled={!!busy||selected.length===0||selected.length>100}
     onClick={()=>void exportPdf(selected)}>ดาวน์โหลด PDF รวม ({selected.length})</button>
   </div>
   <State loading={records.isPending} error={records.error} empty={!shown.length}>
    <div className="table-wrap"><table><thead><tr>
     <th>เลือก</th><th>ชื่อ–สกุล</th><th>ตำแหน่ง / สังกัด</th><th>เลขประจำตัวสอบ</th><th>สถานะ</th><th>ดำเนินการ</th>
    </tr></thead><tbody>{shown.map(r=>{
     const active=!!r.issued_at&&!r.revoked_at&&r.schedule_published;
     const ready=r.has_photo&&r.has_signature&&r.schedule_published;
     return <tr key={r.assignment_id}>
      <td><input type="checkbox" disabled={!active||!!busy} aria-label={"เลือกรายชื่อ "+r.applicant_name}
       checked={selected.includes(r.assignment_id)} onChange={e=>setSelected(xs=>e.target.checked
        ? [...xs,r.assignment_id]:xs.filter(x=>x!==r.assignment_id))}/></td>
      <td>{r.applicant_name}</td><td>{r.job_title}<small>{r.department} · {r.round_name}</small></td>
      <td>{r.exam_number}</td>
      <td>{active?"ออกบัตรแล้ว":r.revoked_at?"ยกเลิก":"รอออกบัตร"}</td>
      <td><div className="flex gap-2 flex-wrap">
       {active&&<button type="button" className="btn outline small" disabled={!!busy}
        onClick={()=>void exportPdf([r.assignment_id])}>ดาวน์โหลด PDF</button>}
       {auth.role==="admin"&&!active&&<button type="button" className="btn primary small" disabled={!ready||!!busy}
        onClick={()=>{if(window.confirm("ยืนยันออกบัตรสอบ?"))void operate(
         ()=>rpc("admin_exam_card_issue",{p_assignment:r.assignment_id,p_confirm:true}),"issue");}}>อนุมัติออกบัตร</button>}
       {auth.role==="admin"&&active&&<button type="button" className="btn danger small" disabled={!!busy}
        onClick={()=>{const reason=window.prompt("เหตุผลที่ยกเลิกบัตรสอบ (อย่างน้อย 5 ตัวอักษร)");
         if(reason&&reason.trim().length>=5&&window.confirm("ยืนยันยกเลิกบัตร?"))void operate(
         ()=>rpc("admin_exam_card_revoke",{p_assignment:r.assignment_id,p_reason:reason}),"revoke");}}>ยกเลิกบัตร</button>}
      </div></td>
     </tr>;
    })}</tbody></table></div>
   </State>
   <Link to="/staff/exams" className="btn outline small">กลับหน้าจัดการสอบ</Link>
  </section>
 </div>;
}
