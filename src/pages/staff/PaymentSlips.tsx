import { useState, useMemo } from "react";
import { Download, ReceiptText } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { supabase } from "../../lib/supabase";
import { signedFile } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useCatalog } from "../../hooks/useCatalog";
import { Select, Title, Notice } from "../../components/UI";
import { sortSlipsByApplicantOrder, applicantOrderLabel } from "../../lib/payment-slip-order";

type App = { id:string; application_number:string|null;
  position_order:number|null; display_position_order:number|null; submitted_at:string|null;
  personal_data:{prefix?:string;first_name?:string;last_name?:string} };
type Slip = { id:string; application_id:string; slip_path:string; paid_at:string|null };
const A4:[number,number]=[595.28,841.89];

async function getSlips(jobId:string) {
  const apps:App[]=[];
  for(let start=0;start<5000;start+=500) {
    const {data,error}=await supabase.from("applications")
      .select("id,application_number,personal_data,position_order,display_position_order,submitted_at")
      .eq("job_id",jobId).is("archived_at",null).not("submitted_at","is",null)
      .order("id").range(start,start+499);
    if(error)throw error;
    apps.push(...(data||[]));
    if((data||[]).length<500)break;
  }
  if(apps.length>5000)throw Error("จำนวนผู้สมัครมากเกินขีดจำกัดรายงาน");
  const candidates=new Map(apps.map(a=>[a.id,a]));
  const slips:Slip[]=[];
  for(let k=0;k<apps.length;k+=80) {
    const ids=apps.slice(k,k+80).map(a=>a.id);
    if(!ids.length)continue;
    const {data,error}=await supabase.from("payment_records")
      .select("id,application_id,slip_path,paid_at")
      .in("application_id",ids).order("created_at");
    if(error)throw error;
    slips.push(...(data||[]).filter(x=>x.slip_path));
  }
  // Match the same visible (1), (2), (3) numbering shown in the active
  // applicant roster. Do not sort by UUID, payment ID, or official number.
  const ordered=sortSlipsByApplicantOrder(slips,candidates);
  if(ordered.length>500)throw Error("มีสลิปมากกว่า 500 รายการ กรุณาแบ่งกลุ่มก่อนส่งออก");
  return {slips:ordered,candidates};
}
function labelPng(title:string,name:string,number:string,applicantOrder:string,index:number,total:number){
  const canvas=document.createElement("canvas");
  canvas.width=1200;canvas.height=440;
  const c=canvas.getContext("2d");
  if(!c)throw Error("PDF_RENDER_FAILED");
  c.fillStyle="#fff";c.fillRect(0,0,1200,440);
  c.fillStyle="#102D55";c.fillRect(0,0,1200,100);
  c.fillStyle="#F47721";c.fillRect(0,95,1200,8);
  c.fillStyle="#fff";c.font="bold 38px Tahoma,sans-serif";
  c.fillText("RMUTI KKC - หลักฐานชำระค่าสมัคร",38,67);
  c.fillStyle="#102D55";c.font="bold 32px Tahoma,sans-serif";
  for(const [i,value] of [
    "ลำดับผู้สมัคร: "+applicantOrder+"  —  "+name,
    "ตำแหน่ง: "+title,
    "เลขผู้สมัครทางราชการ: "+number,
    "สลิปผู้สมัคร "+applicantOrder+"  ·  หลักฐาน "+index+" / "+total,
  ].entries()){
    let s=value;
    while(s.length>1&&c.measureText(s).width>1110)s=s.slice(0,-2);
    if(s.length<value.length)s+="…";
    c.fillText(s,40,160+i*65);
  }
  return canvas.toDataURL("image/png");
}
function isPdf(bytes:Uint8Array) {
  return bytes.length>=5&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
}
function isJpg(bytes:Uint8Array) {
  return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
}
function isPng(bytes:Uint8Array) {
  return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
}
async function makePdf(
  items:Slip[], applicants:Map<string,App>,jobTitle:string,
  progress:(message:string)=>void
){
  await document.fonts.ready;
  const pdf=await PDFDocument.create();
  let totalSize=0;
  for(let i=0;i<items.length;i++){
    const slip=items[i],app=applicants.get(slip.application_id);
    if(!app)throw Error("ไม่พบข้อมูลผู้สมัครสำหรับหลักฐาน");
    progress("กำลังรวมสลิป "+(i+1)+"/"+items.length);
    const url=await signedFile(slip.slip_path);
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)throw Error("ไม่สามารถเปิดสลิปของ "+(app.application_number||app.id));
    const bytes=new Uint8Array(await response.arrayBuffer());
    totalSize+=bytes.length;
    if(!bytes.length||bytes.length>12*1024*1024||totalSize>160*1024*1024)
      throw Error("ไฟล์รวมมีขนาดใหญ่เกินกำหนดเพื่อความปลอดภัย กรุณาแบ่งกลุ่ม");
    const name=[app.personal_data?.prefix,app.personal_data?.first_name,
      app.personal_data?.last_name].filter(Boolean).join(" ");
    const applicantOrder=applicantOrderLabel(app);
    const header=await pdf.embedPng(labelPng(
      jobTitle,name,app.application_number||"รอออกเลข",applicantOrder,i+1,items.length,
    ));
    const first=pdf.addPage(A4);
    first.drawImage(header,{x:0,y:A4[1]-218,width:A4[0],height:218});
    if(isPdf(bytes)){
      const input=await PDFDocument.load(bytes);
      if(!input.getPageCount()||input.getPageCount()>20)throw Error("สลิป PDF เกิน 20 หน้า");
      const pages=await pdf.copyPages(input,input.getPageIndices());
      pages.forEach(p=>pdf.addPage(p));
    }else if(isJpg(bytes)||isPng(bytes)){
      const img=isJpg(bytes)?await pdf.embedJpg(bytes):await pdf.embedPng(bytes);
      const page=pdf.addPage(A4);
      const scale=Math.min((A4[0]-48)/img.width,(A4[1]-48)/img.height);
      const w=img.width*scale,h=img.height*scale;
      page.drawImage(img,{x:(A4[0]-w)/2,y:(A4[1]-h)/2,width:w,height:h});
    }else throw Error("ไฟล์สลิปไม่ใช่ PDF, JPG หรือ PNG");
  }
  const data=await pdf.save();
  return new Blob([new Uint8Array(data).buffer],{type:"application/pdf"});
}

export default function PaymentSlips(){
  const auth=useAuth(),catalog=useCatalog();
  const [year,setYear]=useState(""),[round,setRound]=useState(""),[job,setJob]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [count,setCount]=useState<number|null>(null);
  const [download,setDownload]=useState<{name:string,url:string}|null>(null);
  const rounds=useMemo(()=>catalog.rounds.data?.filter(r=>!year||String(r.year_be)===year)||[],
    [catalog.rounds.data,year]);
  const jobs=useMemo(()=>catalog.jobs.data?.filter(j=>
    (!year||String(j.recruitment_rounds?.year_be)===year)&&(!round||j.round_id===round))||[],
    [catalog.jobs.data,year,round]);
  const chosen=jobs.find(j=>j.id===job);
  const reset=()=>{
    setCount(null);setError("");setMessage("");
    if(download)URL.revokeObjectURL(download.url);
    setDownload(null);
  };
  const run=async(preview:boolean)=>{
    if(!chosen||busy||!auth.can("reports"))return;
    setBusy(true);setError("");setMessage("กำลังอ่านรายการสลิป...");
    try{
      const {slips,candidates}=await getSlips(chosen.id);
      setCount(slips.length);
      if(preview){setMessage("พบสลิป "+slips.length+" รายการ เรียงตามเลขลำดับผู้สมัคร (1), (2), (3)…");return;}
      if(!slips.length)throw Error("ไม่พบสลิปในตำแหน่งนี้");
      if(count!==slips.length)throw Error("จำนวนสลิปเปลี่ยน กรุณาตรวจจำนวนก่อนดาวน์โหลดอีกครั้ง");
      const pdf=await makePdf(slips,candidates,chosen.title,setMessage);
      const filename=("สลิปค่าสมัคร_"+(chosen.recruitment_rounds?.year_be||"")+
        "_"+chosen.title).replace(/[\\/:*?"<>|]/g,"-").slice(0,120)+".pdf";
      if(download)URL.revokeObjectURL(download.url);
      const url=URL.createObjectURL(pdf);
      setDownload({url,name:filename});
      const a=document.createElement("a");
      a.href=url;a.download=filename;a.click();
      setMessage("รวมสลิป "+slips.length+" รายการเป็น PDF เรียงตามเลขลำดับผู้สมัครแล้ว");
    }catch(e){setError(e instanceof Error?e.message:"ไม่สามารถส่งออกสลิปได้");}
    finally{setBusy(false);}
  };
  if(!auth.can("reports"))return <Notice kind="error">ไม่มีสิทธิ์ดูรายงานการชำระเงิน</Notice>;
  return <div className="container section">
    <Title title="ดาวน์โหลดสลิปค่าสมัคร" eyebrow="PAYMENT EVIDENCE"
      description="เลือกปี รอบรับสมัคร และตำแหน่ง เพื่อรวมสลิปเป็น PDF ไฟล์เดียว เรียงตามเลขลำดับผู้สมัคร (1), (2), (3)…"/>
    <section className="panel stack">
      <div className="form-grid">
        <Select label="ปี พ.ศ." value={year} disabled={busy} onChange={e=>{
          setYear(e.target.value);setRound("");setJob("");reset();
        }}><option value="">ทุกปี</option>
        {Array.from(new Set(catalog.rounds.data?.map(r=>r.year_be)||[])).sort((a,b)=>b-a)
          .map(y=><option key={y} value={y}>{y}</option>)}</Select>
        <Select label="รอบรับสมัคร" value={round} disabled={busy} onChange={e=>{
          setRound(e.target.value);setJob("");reset();
        }}><option value="">ทุกรอบ</option>
        {rounds.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        <Select label="ตำแหน่งที่สมัคร" value={job} disabled={busy} onChange={e=>{
          setJob(e.target.value);reset();
        }}><option value="">เลือกตำแหน่ง</option>
        {jobs.map(j=><option key={j.id} value={j.id}>
          {j.title} — {j.departments?.name}
        </option>)}</Select>
      </div>
      <p className="muted">รวมเฉพาะหลักฐานชำระเงินของใบสมัครที่ส่งแล้วในตำแหน่งที่เลือก ไม่รวมคลังสำรอง ข้อมูลนี้สำหรับเจ้าหน้าที่ผู้มีสิทธิ์เท่านั้น และไม่ได้แก้ไขต้นฉบับ</p>
      <button type="button" className="btn outline" disabled={!chosen||busy} onClick={()=>void run(true)}>
        <ReceiptText size={17}/> 1. ตรวจจำนวนสลิป
      </button>
      {count!==null&&<div className="subpanel stack">
        <strong>{chosen?.title}</strong>
        <p>พบสลิปค่าสมัคร {count} รายการ · จะเรียงตามลำดับผู้สมัครของตำแหน่ง เช่น (1) ชื่อผู้สมัคร → สลิปของ (1) → (2) ชื่อผู้สมัคร → สลิปของ (2)</p>
        <button type="button" className="btn primary" disabled={!count||busy} onClick={()=>void run(false)}>
          <Download size={17}/> 2. ดาวน์โหลดสลิปรวม PDF
        </button>
      </div>}
      {busy&&message&&<p role="status" className="muted">{message}</p>}
      {!busy&&message&&<Notice kind="success">{message}</Notice>}
      {error&&<Notice kind="error">{error}</Notice>}
      {download&&<a className="btn outline" href={download.url} download={download.name}>
        <Download size={17}/> ดาวน์โหลด PDF อีกครั้ง
      </a>}
    </section>
  </div>;
}
