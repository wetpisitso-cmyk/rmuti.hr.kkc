import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, CalendarDays, ClipboardCheck, CreditCard, FileDown, FileSignature, FileText, LockKeyhole, Megaphone, Settings, ShieldCheck, Trash2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
type GuideStep={number:string;title:string;description:string;details:string[];Icon:LucideIcon;to?:string;label?:string};
const workflow:GuideStep[]=[
 {number:"01",title:"เข้าสู่ระบบ Admin",description:"ใช้บัญชีผู้ดูแลระบบที่ได้รับสิทธิ์",details:["เข้าหน้าเข้าสู่ระบบ Admin ด้วย Username และ Password ที่กำหนดไว้","หากเป็นบัญชี Admin เดิมที่ยังไม่มี Username ให้ตั้งค่าจากหน้าตั้งค่าระบบก่อน","ไม่แบ่งปันรหัสผ่าน และออกจากระบบเมื่อใช้งานเสร็จ"],Icon:LockKeyhole,to:"/admin/login",label:"หน้าเข้าสู่ระบบ"},
 {number:"02",title:"ตั้งค่าหน่วยงานและรอบรับสมัคร",description:"จัดเตรียมข้อมูลก่อนเปิดรับสมัคร",details:["ตรวจสอบชื่อหน่วยงาน ข้อมูลติดต่อ และนโยบายข้อมูลส่วนบุคคลในเมนูตั้งค่า","ไปที่ «รอบรับสมัคร» กำหนดปี พ.ศ. วันเริ่ม–สิ้นสุด และจำนวนตำแหน่งต่อคน","ตรวจทานวันเวลาให้ถูกต้องก่อนเลือกเผยแพร่รอบ"],Icon:CalendarDays,to:"/staff/rounds",label:"จัดการรอบรับสมัคร"},
 {number:"03",title:"สร้างตำแหน่งและรายการเอกสาร",description:"ประกาศตำแหน่งให้ผู้สมัครเห็น",details:["ไปเมนู «ตำแหน่งรับสมัคร» แล้วเพิ่มหรือแก้ไขตำแหน่ง","เลือกหน่วยงาน รอบรับสมัคร คุณสมบัติ จำนวนอัตรา และค่าธรรมเนียม (ถ้ามี)","กำหนดประเภทเอกสารบังคับ/ถ้ามี โดยตั้งขนาดไฟล์สูงสุดได้ 1–3 MB ต่อไฟล์","เลือกเผยแพร่เมื่อรายละเอียดถูกต้องครบถ้วน ตำแหน่งที่เก็บถาวรจะไม่เปิดรับสมัครใหม่"],Icon:BriefcaseBusiness,to:"/staff/jobs",label:"จัดการตำแหน่ง"},
 {number:"04",title:"ตรวจสอบและค้นหาใบสมัคร",description:"อ่านรายละเอียดและหลักฐานก่อนพิจารณา",details:["เปิด «ตรวจใบสมัคร» กรองตามปี รอบ ตำแหน่ง หน่วยงาน สถานะ หรือค้นหาชื่อ/เลขผู้สมัคร","เปิดใบสมัครที่ต้องการ เพื่อตรวจข้อมูลส่วนตัว คุณวุฒิ และเอกสารแนบ","บันทึกหมายเหตุภายใน หรือส่งกลับให้แก้ไขเมื่อเอกสารไม่ครบ/ข้อมูลผิด","เปลี่ยนสถานะการตรวจคุณสมบัติตามผลการพิจารณา"],Icon:ClipboardCheck,to:"/staff/applications",label:"ตรวจใบสมัคร"},
 {number:"05",title:"ตรวจหลักฐานชำระเงิน",description:"กรณีตำแหน่งที่เรียกเก็บค่าธรรมเนียม",details:["เปิดใบสมัครที่มีหลักฐานชำระเงิน แล้วดูสลิป ยอดเงิน และวันเวลาชำระ","ตรวจความถูกต้องก่อนกดยืนยันหรือไม่ยืนยันรายการชำระเงิน","การอัปโหลดสลิปของผู้สมัครไม่ทำให้สถานะชำระเงินผ่านโดยอัตโนมัติ"],Icon:CreditCard,to:"/staff/applications",label:"เปิดรายการใบสมัคร"},
 {number:"06",title:"ออกเลขผู้สมัครแบบกำหนดเอง",description:"เลขภาษาไทย ภาษาอังกฤษ และตัวเลข",details:["เปิดใบสมัครที่ส่งแล้ว ไปที่ส่วน «ออกเลขผู้สมัครโดย Admin»","กำหนดเลขได้อิสระ เช่น มทร.ขก./๒๕๖๙/๐๐๑ หรือ HR-2569-001","ระบบตรวจเลขซ้ำ และอาจล็อกการเปลี่ยนเลขหลังมีลายเซ็นรับรองแล้ว","ตรวจเลขให้ถูกต้องก่อนกดยืนยันการออกเลข"],Icon:FileText,to:"/staff/applications",label:"จัดการเลขผู้สมัคร"},
 {number:"07",title:"ยืนยันดาวน์โหลด PDF และลายเซ็น",description:"รับรองใบสมัครผ่านระบบที่กำหนด",details:["หลังตรวจข้อมูลและออกเลข ให้ใช้ปุ่ม «ยืนยันให้ดาวน์โหลดใบสมัคร» ในหน้าใบสมัคร","ผู้สมัครจะดาวน์โหลดหรือพิมพ์ PDF ฉบับใบสมัครได้ต่อเมื่อ Admin ยืนยันแล้ว","ถ้าต้องใช้ลายเซ็นออนไลน์ ให้ลงนามในส่วน Admin หลังใบสมัครผ่านคุณสมบัติและสถานะชำระเงินตรงตามเงื่อนไข","ตรวจทานก่อนเซ็น เพราะระบบออกแบบให้ลายเซ็นที่บันทึกแล้วแก้ไขทับไม่ได้"],Icon:FileSignature,to:"/staff/applications",label:"ตรวจและรับรองใบสมัคร"},
 {number:"08",title:"กำหนดสอบและบันทึกผล",description:"จัดการเลขสอบ คะแนน และผลคัดเลือก",details:["เมนู «การสอบและคะแนน» ใช้สร้างกำหนดสอบและเลือกเผยแพร่ตามรอบ","กำหนดผู้เข้าสอบ เลขสอบ และข้อมูลที่จำเป็นผ่านเมนูของระบบ","บันทึกคะแนนและผลร่าง ตรวจความถูกต้องก่อนขั้นตอนเผยแพร่"],Icon:ClipboardCheck,to:"/staff/exams",label:"การสอบและคะแนน"},
 {number:"09",title:"ประกาศและเผยแพร่ผล",description:"เผยแพร่เฉพาะข้อมูลที่ผ่านการตรวจแล้ว",details:["เมนู «ประกาศและเผยแพร่» สร้างประกาศ พร้อมลิงก์เอกสารประกอบเมื่อมี","ตรวจตัวอย่างผลคัดเลือกและรายชื่อที่จะเผยแพร่ก่อนกดยืนยัน","ผลร่างที่ยังไม่ได้เผยแพร่ไม่ควรใช้เป็นประกาศทางการ"],Icon:Megaphone,to:"/staff/publish",label:"ประกาศและเผยแพร่"},
 {number:"10",title:"รายงาน บัญชีผู้ใช้ และการดูแลข้อมูล",description:"ตรวจสอบและจัดการหลังบ้านอย่างปลอดภัย",details:["หน้าภาพรวมและตรวจใบสมัครมีตัวกรองตามปี/รอบ/หน่วยงาน พร้อมส่งออก CSV หรือพิมพ์หน้าเป็น PDF ตามสิทธิ์","เมนู «บัญชีและสิทธิ์» ใช้กำหนดบทบาทและสิทธิ์ของเจ้าหน้าที่","เมนู «ตั้งค่า / ประวัติ» ใช้ตรวจประวัติการเปลี่ยนแปลง ข้อมูลติดต่อ นโยบาย และตั้ง Username Admin","ระมัดระวังคำสั่งลบถาวร: ลบได้เฉพาะเมื่อสิทธิ์และข้อจำกัดของข้อมูลอนุญาต และข้อมูลที่ลบอาจไม่สามารถกู้คืน"],Icon:Settings,to:"/staff/settings",label:"การตั้งค่าและประวัติ"},
];
const faq=[
 ["ผู้สมัครยังดาวน์โหลดใบสมัคร PDF ไม่ได้ เพราะอะไร?","ต้องให้ Admin ออกเลขผู้สมัครและกด «ยืนยันให้ดาวน์โหลดใบสมัคร» ก่อน ระบบตรวจสิทธิ์ที่หน้าเปิด PDF ไม่ใช่เพียงซ่อนปุ่ม"],
 ["ออกเลขภาษาไทยได้หรือไม่?","ได้ สามารถกรอกเลขที่ภาษาไทยและรูปแบบที่ต้องการได้โดยไม่ซ้ำกัน แต่บางกรณีไม่สามารถเปลี่ยนเลขได้หลังรับรองลายเซ็น"],
 ["อัปโหลดเอกสารได้ขนาดเท่าไร?","ระบบจำกัดไฟล์ใหม่สูงสุด 3 MB ต่อไฟล์ รวมรูปภาพ PDF และสลิป สามารถกำหนดขนาดต่ำกว่านี้ได้ตามตำแหน่ง"],
 ["เหตุใดลบตำแหน่งไม่สำเร็จ?","หากมีใบสมัครหรือข้อมูลที่อ้างอิงตำแหน่ง ระบบอาจไม่อนุญาตให้ลบถาวร ให้ใช้ «เก็บถาวร» เพื่อหยุดเผยแพร่และคงข้อมูลเดิมก่อน"],
 ["เจ้าหน้าที่ทุกคนเห็นเมนู Admin หรือไม่?","ไม่ เมนูถูกจำกัดตามบทบาทและสิทธิ์ ส่วนคู่มือนี้ต้องเป็นบัญชี Admin เท่านั้น ผู้สมัครทั่วไปเข้าไม่ได้"],
 ["ต้องการดูประวัติการเปลี่ยนแปลงทำอย่างไร?","เปิดเมนู «ตั้งค่า / ประวัติ» และตรวจรายการในส่วนประวัติการเปลี่ยนแปลงล่าสุด"],
];
export default function AdminGuide(){
 const auth=useAuth();
 if(auth.loading) return <div className="manual-page"><p>กำลังตรวจสอบสิทธิ์…</p></div>;
 if(!auth.session || auth.role!=="admin") return <div className="manual-page"><div className="manual-access-denied"><ShieldCheck size={26}/><h2>สงวนสิทธิ์เฉพาะผู้ดูแลระบบ</h2><p>คู่มือฉบับนี้เข้าถึงได้เฉพาะบัญชี Admin ที่ได้รับอนุญาต</p></div></div>;
 return <div className="manual-page admin-manual">
  <header className="manual-hero">
   <div className="manual-hero-content">
    <span className="manual-eyebrow"><ShieldCheck size={17}/> ADMINISTRATOR HANDBOOK · PRIVATE</span>
    <h1>คู่มือการใช้งาน<br/><span>สำหรับผู้ดูแลระบบ</span></h1>
    <p>แนวทางใช้งานหลังบ้านตั้งแต่เปิดรอบรับสมัคร ตรวจเอกสาร ออกเลข รับรองใบสมัคร ไปจนถึงการเผยแพร่ผล</p>
    <div className="manual-hero-actions">
     <Link className="btn manual-light-btn" to="/staff"><ArrowRight size={18}/> กลับหน้าภาพรวม</Link>
     <a className="btn manual-ghost-btn" href="#admin-workflow"><BookOpenCheck size={17}/> อ่านขั้นตอนการทำงาน</a>
    </div>
   </div>
   <div className="manual-hero-art" aria-hidden="true"><div className="manual-art-icon"><ShieldCheck size={76} strokeWidth={1.5}/></div><span className="manual-art-label"><LockKeyhole size={17}/> ADMIN ACCESS ONLY</span></div>
  </header>
  <section className="manual-info-banner admin-manual-info">
   <div><LockKeyhole size={23}/><span><strong>สิทธิ์เฉพาะ Admin</strong><small>เข้าสู่ระบบก่อนอ่านคู่มือ</small></span></div>
   <div><FileSignature size={23}/><span><strong>ออกเลข / อนุมัติ PDF</strong><small>ตรวจสอบก่อนรับรองทุกครั้ง</small></span></div>
   <div><ShieldCheck size={23}/><span><strong>คุ้มครองข้อมูลผู้สมัคร</strong><small>ตรวจสอบก่อนส่งออกและลบข้อมูล</small></span></div>
  </section>
  <section className="manual-section" id="admin-workflow">
   <div className="manual-section-heading"><div><span className="manual-kicker">ADMIN WORKFLOW</span><h2>ขั้นตอนการจัดการระบบ 10 ขั้นตอน</h2><p>อ้างอิงชื่อเมนูและสิทธิ์จากระบบที่กำลังใช้งานจริง</p></div></div>
   <div className="manual-steps">
    {workflow.map(({number,title,description,details,Icon,to,label})=><article className="manual-step" key={number}>
     <div className="manual-step-top"><span className="manual-step-number">{number}</span><span className="manual-step-icon"><Icon size={25}/></span></div>
     <h3>{title}</h3><p className="manual-step-summary">{description}</p>
     <ul>{details.map(detail=><li key={detail}>{detail}</li>)}</ul>
     {to&&<Link className="manual-step-link" to={to}>{label} <ArrowRight size={16}/></Link>}
    </article>)}
   </div>
  </section>
  <section className="manual-section manual-admin-quick">
   <div className="manual-section-heading"><div><span className="manual-kicker">QUICK ACCESS</span><h2>เมนูที่ใช้บ่อย</h2></div></div>
   <div className="manual-quick-links">
    {[{to:"/staff/applications",Icon:ClipboardCheck,label:"ตรวจใบสมัคร"},{to:"/staff/jobs",Icon:BriefcaseBusiness,label:"ตำแหน่งรับสมัคร"},{to:"/staff/rounds",Icon:CalendarDays,label:"รอบรับสมัคร"},{to:"/staff/publish",Icon:Megaphone,label:"ประกาศและผล"},{to:"/staff/users",Icon:Users,label:"บัญชีและสิทธิ์"},{to:"/staff/settings",Icon:Settings,label:"ตั้งค่า / ประวัติ"}].map(({to,Icon,label})=><Link to={to} key={to}><Icon size={21}/><span>{label}</span><ArrowRight size={16}/></Link>)}
   </div>
  </section>
  <section className="manual-section manual-admin-help">
   <div className="manual-section-heading"><div><span className="manual-kicker">TROUBLESHOOTING</span><h2>คำถามที่พบบ่อยสำหรับ Admin</h2></div></div>
   <div className="manual-faq-list">{faq.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
   <p className="manual-admin-warning"><Trash2 size={18}/> ก่อนลบข้อมูลผู้สมัครหรือตำแหน่ง โปรดตรวจสอบผลกระทบ เพราะการลบถาวรอาจไม่สามารถกู้คืนได้</p>
   <Link className="manual-step-link" to="/staff/settings"><FileDown size={17}/> ตรวจสอบการตั้งค่าและประวัติระบบ <ArrowRight size={16}/></Link>
  </section>
 </div>;
}
