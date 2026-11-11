import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { dateTH } from "../lib/format";
import { errorTH } from "../lib/errors";
import { ThaiDateField } from "./ThaiDateField";

type StaffNotice = {id:string;application_id:string|null;title:string;message:string;read_at:string|null;created_at:string;event_key:string|null};
type Revision = {field:string;before?:unknown;after?:unknown;changed?:boolean};
const labels:Record<string,string>={prefix:"คำนำหน้า",first_name:"ชื่อ",last_name:"นามสกุล",english_name:"ชื่อภาษาอังกฤษ",birth_date:"วันเกิด",phone:"โทรศัพท์",address:"ที่อยู่",registered_address:"ที่อยู่ตามทะเบียนบ้าน",national_id:"เลขประจำตัวประชาชน",military_status:"สถานภาพทหาร",skills:"ทักษะ",gender:"เพศ",nationality:"สัญชาติ",marital_status:"สถานภาพ",education:"การศึกษา",experience:"ประสบการณ์",documents:"เอกสารแนบ"};
function kind(n:StaffNotice){return n.title.includes("แก้ไข")?"corrected":n.title.includes("ค้าง")?"overdue":"new";}
function RevisionDetails({id}:{id:string}){
 const q=useQuery({queryKey:["staff-revision",id],queryFn:async()=>{const r=await supabase.rpc("staff_notification_revision",{p_application:id});if(r.error)throw r.error;return (Array.isArray(r.data)?r.data:[]) as Revision[];}});
 if(q.isPending)return <small>กำลังอ่านประวัติการแก้ไข…</small>;
 if(q.error)return <small role="alert">ไม่สามารถอ่านประวัติ: {errorTH(q.error)}</small>;
 if(!q.data?.length)return <small>ไม่พบความแตกต่างในฟิลด์ที่บันทึกไว้ หรือเป็นข้อมูลก่อนเปิดระบบเปรียบเทียบ</small>;
 return <div className="staff-revision-list"><strong>ข้อมูลที่เปลี่ยนแปลง</strong>{q.data.map((d,i)=><div key={i} className="staff-revision-row"><b>{labels[d.field]||d.field}</b>{d.changed?<span>มีการแก้ไข (เปิดใบสมัครเพื่อตรวจรายละเอียด)</span>:<span>ก่อน: {d.field==="national_id"?"•••••••••••••":String(d.before??"–")} → หลัง: {d.field==="national_id"?"•••••••••••••":String(d.after??"–")}</span>}</div>)}</div>;
}
export default function StaffApplicationNotifications(){
 const auth=useAuth(),qc=useQueryClient();
 const [error,setError]=useState(""),[filter,setFilter]=useState("all"),[search,setSearch]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[page,setPage]=useState(0),[expanded,setExpanded]=useState<string|null>(null);
 const enabled=!!auth.session&&(auth.role==="admin"||auth.role==="hr");
 const notices=useQuery({queryKey:["staff-application-notifications",auth.session?.user.id],enabled,refetchInterval:20_000,queryFn:async()=>{
  const r=await supabase.from("notifications").select("id,application_id,title,message,read_at,created_at,event_key").eq("user_id",auth.session!.user.id).like("event_key","staff-application:%").order("created_at",{ascending:false}).limit(1000);
  if(r.error)throw r.error;return (r.data||[]) as StaffNotice[];
 }});
 const overdue=useQuery({queryKey:["staff-overdue-applications"],enabled,refetchInterval:60_000,queryFn:async()=>{
   const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
   const r=await supabase.from("applications").select("id,application_number,personal_data,submitted_at,status").in("status",["submitted","under_review"]).lt("submitted_at",cutoff).is("archived_at",null).order("submitted_at",{ascending:true}).limit(30);
   if(r.error)throw r.error;return r.data||[];
 }});
 // A notification may be read without the application being reviewed. Keep
 // completed applications out of the active inbox, but preserve history.
 const ids=[...new Set((notices.data||[]).map(n=>n.application_id).filter((id):id is string=>!!id))];
 const reviewed=useQuery({
   queryKey:["staff-notice-reviewed-applications",ids.join(",")],
   enabled:enabled&&notices.isSuccess&&ids.length>0,
   refetchInterval:20_000,
   queryFn:async()=>{
     const completed=new Set<string>();
     for(let i=0;i<ids.length;i+=150){
       const batch=ids.slice(i,i+150);
       const [applications,steps]=await Promise.all([
         supabase.from("applications").select("id,status").in("id",batch),
         supabase.from("application_review_steps").select("application_id").in("application_id",batch)
       ]);
       if(applications.error)throw applications.error;
       if(steps.error)throw steps.error;
       for(const a of applications.data||[]){
         if(["eligible","ineligible","withdrawn"].includes(a.status))completed.add(a.id);
       }
       for(const step of steps.data||[])completed.add(step.application_id);
     }
     return [...completed];
   }
 });
 const reviewedIds=new Set(reviewed.data||[]);
 const isCompleted=(n:StaffNotice)=>!!n.application_id&&reviewedIds.has(n.application_id);
 const active=(notices.data||[]).filter(n=>!isCompleted(n));
 const unread=reviewed.isPending||reviewed.error?0:active.filter(n=>!n.read_at).length;
 const list=(filter==="history"?(notices.data||[]).filter(isCompleted):active).filter(n=>(filter==="all"||filter==="history"||filter==="unread"&&!n.read_at||filter===kind(n))&&(!search||n.message.toLowerCase().includes(search.toLowerCase()))&&(!from||n.created_at>=from+"T00:00:00+07:00")&&(!to||n.created_at<=to+"T23:59:59+07:00"));
 const shown=reviewed.isPending||reviewed.error?[]:list.slice(page*20,(page+1)*20);
 const refresh=async()=>{await Promise.all([qc.invalidateQueries({queryKey:["staff-application-notifications"]}),qc.invalidateQueries({queryKey:["staff-notice-reviewed-applications"]}),qc.invalidateQueries({queryKey:["header-notification-count"]})]);};
 const markRead=async(id:string)=>{setError("");const r=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("user_id",auth.session!.user.id).is("read_at",null);if(r.error)setError(errorTH(r.error));else await refresh();};
 const markAll=async()=>{setError("");const r=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",auth.session!.user.id).like("event_key","staff-application:%").is("read_at",null);if(r.error)setError(errorTH(r.error));else await refresh();};
 if(!enabled)return null;
 return <section id="staff-notifications" className="panel staff-application-notifications">
  <div className="staff-notice-heading"><div><h2><Bell size={22}/> ศูนย์แจ้งเตือนผู้สมัคร {unread>0&&<span className="staff-notice-count">{unread} ยังไม่อ่าน</span>}</h2><p className="muted">รายการรอตรวจ · ส่งแก้ไข · ประวัติที่ตรวจแล้ว (อัปเดตทุก 20 วินาที)</p></div><div className="flex gap-2 flex-wrap"><button className="btn outline small" onClick={()=>void notices.refetch()}><RefreshCw size={16}/> รีเฟรช</button>{unread>0&&<button className="btn outline small" onClick={()=>void markAll()}><CheckCheck size={16}/> อ่านทั้งหมด</button>}</div></div>
  {!!overdue.data?.length&&<div className="staff-overdue-section"><h3>ใบสมัครค้างตรวจเกิน 24 ชั่วโมง ({overdue.data.length}{overdue.data.length===30?"+":""})</h3><p className="muted">นับจากเวลาส่งใบสมัคร รายการที่อยู่ระหว่างตรวจอาจแสดงอยู่จนกว่าจะบันทึกผล</p>{overdue.data.slice(0,8).map(a=><div className="staff-overdue-row" key={a.id}><span>{a.personal_data?.first_name} {a.personal_data?.last_name} · {a.application_number||"รอเลขผู้สมัคร"} · {dateTH(a.submitted_at,true)}</span><Link className="btn outline small" to={`/staff/applications/${a.id}`}>เปิดตรวจ <ArrowRight size={14}/></Link></div>)}</div>}
  <div className="staff-notice-summary"><span>สมัครใหม่ <b>{active.filter(n=>kind(n)==="new").length}</b></span><span>ส่งแก้ไข <b>{active.filter(n=>kind(n)==="corrected").length}</b></span><span>ยังไม่อ่าน <b>{unread}</b></span><span>ตรวจแล้ว <b>{(notices.data||[]).length-active.length}</b></span></div>
  <div className="staff-notice-filters"><label>ประเภท<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">ทั้งหมด</option><option value="new">สมัครใหม่</option><option value="corrected">ส่งแก้ไขแล้ว</option><option value="overdue">ค้างตรวจ</option><option value="unread">ยังไม่อ่าน</option><option value="history">ตรวจแล้ว (ประวัติ)</option></select></label><label>ค้นหาชื่อ / ตำแหน่ง<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="ค้นหา…"/></label><ThaiDateField label="ตั้งแต่ (พ.ศ.)" value={from} onChange={v=>{setFrom(v);setPage(0);}}/><ThaiDateField label="ถึง (พ.ศ.)" value={to} onChange={v=>{setTo(v);setPage(0);}}/></div>
  {error&&<p role="alert" className="notice error">{error}</p>}{notices.error&&<p role="alert" className="notice error">{errorTH(notices.error)}</p>}{(notices.isPending||reviewed.isPending)&&<p>กำลังโหลด…</p>}{reviewed.error&&<p role="alert" className="notice error">ไม่สามารถตรวจสถานะใบสมัคร: {errorTH(reviewed.error)}</p>}{notices.isSuccess&&!reviewed.isPending&&!list.length&&<p className="muted">ไม่พบรายการตามตัวกรอง</p>}
  <div className="staff-notice-list">{shown.map(n=><div key={n.id} className={`staff-notice-item ${n.read_at?"is-read":"is-unread"}`}>
   <div className="staff-notice-body"><div className="flex gap-2 flex-wrap items-center"><strong>{n.title}</strong><span className={`staff-notice-kind ${kind(n)}`}>{kind(n)==="corrected"?"ส่งแก้ไข":kind(n)==="overdue"?"ค้างตรวจ":"สมัครใหม่"}</span></div><p>{n.message}</p><small>{dateTH(n.created_at,true)} · {n.read_at?"อ่านแล้ว":"ยังไม่อ่าน"}</small>{expanded===n.id&&n.application_id&&<RevisionDetails id={n.application_id}/>}</div>
   <div className="staff-notice-actions">{kind(n)==="corrected"&&n.application_id&&<button className="btn outline small" onClick={()=>setExpanded(expanded===n.id?null:n.id)}>{expanded===n.id?"ซ่อนการแก้ไข":"ดูจุดที่แก้ไข"}</button>}{n.application_id&&<Link className="btn primary small" to={`/staff/applications/${n.application_id}`} onClick={()=>{if(!n.read_at)void markRead(n.id);}}>เปิดใบสมัคร <ArrowRight size={15}/></Link>}{!n.read_at&&<button className="btn outline small" onClick={()=>void markRead(n.id)}>อ่านแล้ว</button>}</div>
  </div>)}</div>
  {list.length>20&&<div className="pagination"><button className="btn outline small" disabled={page===0} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><span>หน้า {page+1} / {Math.ceil(list.length/20)}</span><button className="btn outline small" disabled={(page+1)*20>=list.length} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></div>}
  <small className="muted">แสดงประวัติสูงสุด 1,000 รายการล่าสุดต่อบัญชี · รายการที่ตรวจแล้วไม่ถูกลบ สามารถดูได้ในตัวกรอง ตรวจแล้ว (ประวัติ)</small>
 </section>;
}
