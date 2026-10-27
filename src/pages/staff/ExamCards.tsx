import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCatalog } from "../../hooks/useCatalog";
import { rpc } from "../../services/api";
import { errorTH } from "../../lib/errors";
import { State,Notice,Title,Select,Field } from "../../components/UI";
import { examCardForExport, type ExamCardListing } from "../../lib/exam-card-data";
import { makeExamCardPdf,downloadExamCard,EXAM_CARD_INSTRUCTIONS } from "../../lib/exam-card-pdf";
export default function ExamCards() {
 const auth=useAuth(),catalog=useCatalog(),qc=useQueryClient();
 const [year,setYear]=useState(""),[round,setRound]=useState(""),[job,setJob]=useState(""),[department,setDepartment]=useState(""),[label,setLabel]=useState("ครั้งที่ 40 / 2569");
 const [busy,setBusy]=useState(""),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [historyFor,setHistoryFor]=useState("");
 const [history,setHistory]=useState<{action:string;created_at:string;metadata:Record<string,unknown>}[]>([]);
 const [previewUrl,setPreviewUrl]=useState<string|null>(null);
 useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);},[previewUrl]);
 const records=useQuery({queryKey:["exam-card-list",round],enabled:auth.can("exams"),
  queryFn:()=>rpc<ExamCardListing[]>("exam_card_list",{p_round:round||null})});
 const roundStatus=useQuery({queryKey:["exam-card-round-status",round],enabled:!!round&&auth.can("exams"),
  queryFn:()=>rpc<{issue_label:string;rules_approved:boolean}>("exam_card_round_status",{p_round:round})});
 useEffect(()=>{if(roundStatus.data?.issue_label)setLabel(roundStatus.data.issue_label);},[roundStatus.data?.issue_label]);
 const rulesApproved=roundStatus.data?.rules_approved===true;
 const shown=(records.data||[]).filter(r=>(!year||String(r.year_be)===year)&&(!job||r.job_id===job)&&(!department||r.department_id===department));
 async function operate(fn:()=>Promise<unknown>,name:string) {
  setBusy(name);setError("");setSuccess("");
  try {await fn();await Promise.all([qc.invalidateQueries({queryKey:["exam-card-list"]}),qc.invalidateQueries({queryKey:["exam-card-round-status"]})]);setSuccess("ดำเนินการเรียบร้อย");}
  catch(e){setError(errorTH(e));}finally{setBusy("");}
 }
 async function exportPdf(ids:string[],asPreview=false){
  await operate(async()=>{
   const cards=[];
   for(const id of ids) cards.push(await examCardForExport(id));
   const pdf=await makeExamCardPdf(cards);
   const safe=ids.length===1?cards[0].card.exam_number.replace(/[^a-zA-Z0-9ก-๙_-]/g,"-"):"batch-"+ids.length;
   if(asPreview)setPreviewUrl(URL.createObjectURL(pdf));
   else downloadExamCard(pdf,"ExamCard_"+safe+".pdf");
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
    <Select label="ปี พ.ศ." value={year} onChange={e=>{setYear(e.target.value);setRound("");setJob("");setDepartment("");setSelected([]);}}><option value="">ทุกปี</option>{Array.from(new Set(catalog.rounds.data?.map(r=>r.year_be)||[])).map(y=><option key={y}>{y}</option>)}</Select>
    <Select label="รอบรับสมัคร" value={round} onChange={e=>{
     const id=e.target.value;setRound(id);setJob("");setSelected([]);
     setLabel(records.data?.find(r=>r.round_id===id)?.issue_label||"ครั้งที่ 40 / 2569");
    }}><option value="">ทุกรอบ</option>
     {catalog.rounds.data?.filter(r=>!year||String(r.year_be)===year).map(r=><option key={r.id} value={r.id}>{r.name} · {r.year_be}</option>)}
    </Select>
    <Select label="หน่วยงาน" value={department} onChange={e=>{setDepartment(e.target.value);setSelected([]);}}><option value="">ทุกหน่วยงาน</option>{Array.from(new Map((records.data||[]).map(r=>[r.department_id,r.department])).entries()).map(([id,name])=><option key={id} value={id}>{name}</option>)}</Select>
    <Select label="ตำแหน่ง" value={job} onChange={e=>{setJob(e.target.value);setSelected([]);}}>
     <option value="">ทุกตำแหน่ง</option>
     {Array.from(new Map((records.data||[]).filter(r=>(!year||String(r.year_be)===year)&&(!department||r.department_id===department)).map(r=>[r.job_id,r.job_title])).entries()).map(([id,title])=><option key={id} value={id}>{title}</option>)}
    </Select>
   </div>
   {auth.role==="admin"&&round&&<div className="flex gap-2 flex-wrap items-end">
    <Field label="ครั้งที่สอบ (เปลี่ยนได้)" value={label} maxLength={100} onChange={e=>setLabel(e.target.value)}/>
    <button className="btn primary" type="button" disabled={!!busy} onClick={()=>void operate(
     ()=>rpc("admin_exam_card_set_round",{p_round:round,p_label:label}),"round")}>บันทึกครั้งที่สอบ</button>
   </div>}
   {round&&<div className="subpanel stack">
    <h3>ข้อปฏิบัติสำหรับผู้เข้าสอบ — ต้องอนุมัติก่อนออกบัตร</h3>
    {EXAM_CARD_INSTRUCTIONS.map((rule,i)=><p key={i}>{rule}</p>)}
    <p className="muted">สถานะการรับรอง: {rulesApproved?"อนุมัติแล้ว":"ยังไม่อนุมัติ"}</p>
    {auth.role==="admin"&&!rulesApproved&&<button type="button" className="btn primary" disabled={!!busy}
     onClick={()=>{if(window.confirm("ตรวจทานข้อความทั้งสองข้อและยืนยันอนุมัติให้ใช้กับบัตรสอบรอบนี้?"))void operate(
       ()=>rpc("admin_exam_card_approve_rules",{p_round:round,p_confirm:true}),"rules");}}>
      อนุมัติข้อความข้อปฏิบัติ</button>}
   </div>}
   <p className="muted">ต้องมีสถานะผ่านคุณสมบัติ กำหนดสอบเผยแพร่ รูปถ่าย ลายเซ็นเจ้าหน้าที่ และการอนุมัติ PDF เดิมครบก่อนออกบัตรสอบ</p>
  </section>
  {previewUrl&&<section className="panel stack">
    <h2>ตัวอย่างบัตรสอบ A4</h2>
    <p className="muted">ตรวจสอบรายละเอียดก่อนดาวน์โหลดหรือพิมพ์</p>
    <iframe title="ตัวอย่างบัตรประจำตัวผู้สมัครสอบ" src={previewUrl} style={{width:"100%",height:660,border:"1px solid #ddd"}} />
    <button className="btn outline small" type="button" onClick={()=>setPreviewUrl(null)}>ปิดตัวอย่าง</button>
   </section>}
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
     const ready=r.has_photo&&r.has_signature&&r.schedule_published&&r.rules_approved;
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
       {active&&<button type="button" className="btn outline small" disabled={!!busy}
        onClick={()=>void exportPdf([r.assignment_id],true)}>ดูตัวอย่าง</button>}
       {auth.role==="admin"&&!active&&<button type="button" className="btn primary small" disabled={!ready||!!busy}
        onClick={()=>{if(window.confirm("ยืนยันออกบัตรสอบ?"))void operate(
         ()=>rpc("admin_exam_card_issue",{p_assignment:r.assignment_id,p_confirm:true}),"issue");}}>อนุมัติออกบัตร</button>}
       {auth.role==="admin"&&<button type="button" className="btn outline small" disabled={!!busy}
        onClick={()=>void operate(async()=>{setHistoryFor(r.assignment_id);setHistory(await rpc("admin_exam_card_history",{p_assignment:r.assignment_id}));},"history")}>
        ประวัติ</button>}
       {auth.role==="admin"&&active&&<button type="button" className="btn danger small" disabled={!!busy}
        onClick={()=>{const reason=window.prompt("เหตุผลที่ยกเลิกบัตรสอบ (อย่างน้อย 5 ตัวอักษร)");
         if(reason&&reason.trim().length>=5&&window.confirm("ยืนยันยกเลิกบัตร?"))void operate(
         ()=>rpc("admin_exam_card_revoke",{p_assignment:r.assignment_id,p_reason:reason}),"revoke");}}>ยกเลิกบัตร</button>}
      </div></td>
     </tr>;
    })}</tbody></table></div>
   </State>
   {historyFor&&<div className="subpanel stack">
    <h3>ประวัติการออกและยกเลิกบัตร</h3>
    {!history.length?<p>ยังไม่มีการดำเนินการ</p>:history.map((h,i)=><p key={i}>{new Date(h.created_at).toLocaleString("th-TH")} — {h.action}</p>)}
   </div>}
   <Link to="/staff/exams" className="btn outline small">กลับหน้าจัดการสอบ</Link>
  </section>
 </div>;
}
