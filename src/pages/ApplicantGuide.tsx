import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BadgeCheck, BookOpenCheck, BriefcaseBusiness, CalendarDays,
  CheckCircle2, ChevronRight, CircleHelp, CreditCard, FileCheck2, FileText,
  FolderOpen, HelpCircle, LockKeyhole, Mail, MapPin, Phone, Printer,
  Search, ShieldCheck, Smartphone, UploadCloud, UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { rows } from "../services/api";

type GuideItem = { number: string; title: string; detail: string; points: string[]; Icon: LucideIcon };
const wizardSteps: GuideItem[] = [
  { number: "01", title: "ข้อมูลส่วนตัว", detail: "กรอกข้อมูลให้ตรงกับหลักฐาน",
    points: ["กรอกคำนำหน้า ชื่อ นามสกุล วันเกิด เบอร์โทร และที่อยู่", "ตรวจสอบชื่อและวันเดือนปีเกิดให้ถูกต้อง", "กรอกเลขบัตรประชาชนเมื่อประกาศนั้นกำหนดให้ต้องใช้"], Icon: UserRound },
  { number: "02", title: "การศึกษา / ประสบการณ์", detail: "เพิ่มประวัติได้ตามที่มีจริง",
    points: ["เพิ่มวุฒิการศึกษา สาขา สถานศึกษา ปีที่สำเร็จ และเกรดเฉลี่ย", "กรอกประสบการณ์ทำงานเมื่อมี และตรวจช่วงวันที่", "ตรวจสอบข้อมูลก่อนกดถัดไป"], Icon: BookOpenCheck },
  { number: "03", title: "เลือกตำแหน่ง", detail: "ตรวจตำแหน่งที่ต้องการสมัคร",
    points: ["ยืนยันตำแหน่งและหน่วยงานตามประกาศ", "อ่านจำนวนอัตรา คุณสมบัติ และค่าธรรมเนียม", "กดถัดไปเพื่อบันทึกแบบร่างก่อนแนบเอกสาร"], Icon: BriefcaseBusiness },
  { number: "04", title: "แนบเอกสาร", detail: "ส่งไฟล์ให้ครบตามรายการบังคับ",
    points: ["ดูเอกสารที่มีเครื่องหมายบังคับ เช่น วุฒิ Transcript รูปถ่าย หรือสำเนาบัตร", "ใช้ PDF / JPG / PNG ตามประเภทเอกสารที่ระบบรองรับ", "ไฟล์ใหม่ไม่เกินขนาดที่กำหนดในตำแหน่ง สูงสุด 3 MB ต่อไฟล์ และสำเนาควรเซ็นรับรองสำเนาถูกต้องก่อนแนบ"], Icon: UploadCloud },
  { number: "05", title: "ชำระเงิน / แนบสลิป", detail: "แสดงเฉพาะตำแหน่งที่มีค่าธรรมเนียม",
    points: ["ตรวจชื่อธนาคาร ชื่อบัญชี ยอดเงิน และ QR Code จากระบบก่อนโอน", "แนบสลิป ระบุวันเวลาชำระและเลขอ้างอิง (ถ้ามี)", "กด «ส่งหลักฐานชำระเงินให้เจ้าหน้าที่ตรวจ» ก่อนกดถัดไป; หากไม่เก็บค่าธรรมเนียม ระบบข้ามขั้นนี้"], Icon: CreditCard },
  { number: "06", title: "ตรวจทาน / ยืนยัน", detail: "ส่งใบสมัครจริงเป็นขั้นตอนสุดท้าย",
    points: ["ตรวจชื่อ ตำแหน่ง ประวัติ และเอกสารอีกครั้ง", "รับทราบนโยบายข้อมูลส่วนบุคคลและรับรองความถูกต้อง", "กด «ยืนยันส่งใบสมัคร» หลังส่งแล้วระบบล็อกข้อมูลจนกว่าเจ้าหน้าที่เปิดให้แก้ไข"], Icon: FileCheck2 },
];
const quickLinks: { to: string; label: string; hint: string; Icon: LucideIcon }[] = [
  { to: "/", label: "ตำแหน่งเปิดรับ", hint: "ค้นหาตำแหน่งและดูคุณสมบัติ", Icon: Search },
  { to: "/register", label: "สมัครสมาชิก", hint: "สร้างบัญชีผู้สมัครด้วยอีเมล", Icon: UserRound },
  { to: "/dashboard", label: "ใบสมัครของฉัน", hint: "ตรวจสถานะและเลขผู้สมัคร", Icon: FolderOpen },
  { to: "/announcements", label: "ประกาศ", hint: "อ่านข่าวและรูปแบนเนอร์ประกาศ", Icon: FileText },
  { to: "/results", label: "ผลคัดเลือก", hint: "ติดตามผลเมื่อมหาวิทยาลัยเผยแพร่", Icon: BadgeCheck },
];
const afterSteps = [
  { title: "ส่งใบสมัครแล้ว", description: "เปิด «ใบสมัครของฉัน» เพื่อตรวจสถานะ ใบสมัครที่ส่งแล้วและการแจ้งเตือน", Icon: CheckCircle2 },
  { title: "รอเจ้าหน้าที่ตรวจ", description: "หากขึ้น «ต้องแก้ไข» ให้เปิดใบสมัครและแก้ตามรายการภายในเวลาที่ระบุ; สลิปต้องผ่านการตรวจยืนยัน", Icon: Search },
  { title: "รอ Admin รับรอง", description: "เจ้าหน้าที่ตรวจข้อมูล เอกสาร ค่าธรรมเนียม ผลคุณสมบัติ กำหนดเลขผู้สมัคร และ Admin เซ็นรับรองก่อนอนุมัติ PDF", Icon: ShieldCheck },
  { title: "ดาวน์โหลด PDF / ติดตามผล", description: "เมื่อ Admin อนุมัติหลังลงลายเซ็นแล้ว จึงพิมพ์หรือบันทึกใบสมัคร PDF ได้; ติดตามกำหนดสอบและผลคัดเลือกต่อไป", Icon: Printer },
];
const faq = [
  ["ต้องเตรียมเอกสารอะไรบ้าง?", "ดูหน้ารายละเอียดของตำแหน่งที่สมัคร แต่ละตำแหน่งกำหนดรายการเอกสารไม่เหมือนกัน สำเนาควรเซ็นรับรองสำเนาถูกต้องก่อนอัปโหลดตามที่ประกาศกำหนด"],
  ["ไฟล์แนบใหญ่เกินไปทำอย่างไร?", "ใช้ไฟล์ PDF / JPG / PNG ที่อ่านชัด และลดขนาดให้ไม่เกินค่าที่ประกาศกำหนด โดยระบบรับไฟล์ใหม่สูงสุด 3 MB ต่อไฟล์ ไม่ใช่ 3 MB รวมทุกไฟล์"],
  ["ต้องชำระค่าธรรมเนียมทุกตำแหน่งไหม?", "ไม่จำเป็น ระบบจะแสดงขั้นชำระเงินเฉพาะตำแหน่งที่เรียกเก็บค่าธรรมเนียม ตรวจเลขบัญชี ชื่อบัญชี และยอดก่อนโอนทุกครั้ง"],
  ["สแกน QR ผ่านมือถือเครื่องเดียวกันไม่ได้?", "ในหน้าชำระเงินกด «เปิดรูป QR ขนาดเต็ม» แล้วบันทึกภาพเพื่อให้แอปธนาคารเลือกสแกนจากรูปได้ตามความสามารถของแอป"],
  ["อัปโหลดสลิปแล้วแปลว่าชำระสำเร็จไหม?", "ยังไม่สำเร็จจนกว่าเจ้าหน้าที่จะตรวจสอบและยืนยันรายการชำระเงิน สถานะจะเปลี่ยนหลังตรวจสอบ"],
  ["ส่งใบสมัครแล้วแก้ไขได้หรือไม่?", "โดยทั่วไปใบสมัครที่ส่งแล้วจะถูกล็อก แก้ได้เมื่อเจ้าหน้าที่ส่งกลับสถานะ «ต้องแก้ไข» และยังอยู่ภายในกำหนดเวลา"],
  ["ทำไมยังไม่มีเลขผู้สมัคร?", "เลขผู้สมัครออกโดย Admin หลังขั้นตอนการตรวจ ไม่ได้ออกอัตโนมัติเมื่อกดส่งใบสมัคร"],
  ["ทำไมปุ่มดาวน์โหลด PDF ยังไม่ขึ้น?", "ระบบต้องผ่านคุณสมบัติ ยืนยันค่าธรรมเนียม (ถ้ามี) ตรวจเอกสาร ออกเลขผู้สมัคร Admin ลงลายเซ็นรับรอง และ Admin กดอนุมัติดาวน์โหลดหลังเซ็นเรียบร้อยแล้ว"],
  ["ใบรับชำระเงินกับใบสมัคร PDF เหมือนกันไหม?", "ไม่เหมือนกัน ใบรับชำระเงินจะแสดงเมื่อเจ้าหน้าที่ยืนยันเงิน ส่วนใบสมัคร PDF มีขั้นตอนอนุมัติและลายเซ็น Admin แยกต่างหาก"],
  ["ลืมรหัสผ่าน หรือสมัครผ่านมือถือได้ไหม?", "ใช้งานได้ทั้งคอมพิวเตอร์ แท็บเล็ต และมือถือ หากลืมรหัสผ่านให้เลือก «ลืมรหัสผ่าน» ในหน้าเข้าสู่ระบบ แล้วตรวจอีเมลที่ลงทะเบียน"],
];
const toc = [
  { id: "applicant-map", name: "เมนูที่ใช้งาน", Icon: Search },
  { id: "applicant-wizard", name: "กรอกใบสมัคร 6 ขั้น", Icon: FileText },
  { id: "applicant-after", name: "หลังส่งใบสมัคร", Icon: ShieldCheck },
  { id: "applicant-faq", name: "คำถามที่พบบ่อย", Icon: CircleHelp },
  { id: "applicant-contact", name: "ติดต่อเจ้าหน้าที่", Icon: Phone },
];
export default function ApplicantGuide() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const contact = settings.data?.find((x) => x.key === "contact")?.value;
  return (
    <div className="container manual-page applicant-guide manual-2026">
      <header className="manual-hero">
        <div className="manual-hero-content">
          <span className="manual-eyebrow"><BookOpenCheck size={17}/> RMUTI KKC · APPLICANT GUIDE</span>
          <h1>คู่มือใช้งานระบบ<br/><span>สำหรับผู้สมัคร</span></h1>
          <p>เรียนรู้การสมัครงานตามหน้าเว็บไซต์จริง ตั้งแต่เลือกตำแหน่ง สมัครสมาชิก กรอกใบสมัคร 6 ขั้นตอน ไปจนถึงดาวน์โหลดเอกสารที่ Admin รับรองแล้ว</p>
          <div className="manual-hero-actions">
            <Link className="btn manual-light-btn" to="/"><BriefcaseBusiness size={18}/> ดูตำแหน่งที่เปิดรับ <ArrowRight size={17}/></Link>
            <Link className="btn manual-ghost-btn" to="/register"><UserRound size={18}/> สมัครสมาชิก</Link>
          </div>
        </div>
        <div className="manual-hero-art" aria-hidden="true"><div className="manual-art-icon"><BookOpenCheck size={78} strokeWidth={1.5}/></div><span className="manual-art-label"><Smartphone size={17}/> ใช้งานได้ทั้งมือถือและคอมพิวเตอร์</span></div>
      </header>

      <nav className="manual-topic-nav" aria-label="สารบัญคู่มือผู้สมัคร">
        {toc.map(({id,name,Icon}) => <a href={"#"+id} key={id}><Icon size={17}/>{name}</a>)}
      </nav>

      <section className="manual-info-banner" aria-label="เตรียมพร้อมก่อนสมัคร">
        <div><Mail size={23}/><span><strong>บัญชีผู้สมัคร</strong><small>อีเมลและรหัสผ่านส่วนตัว ไม่มี OTP</small></span></div>
        <div><UploadCloud size={23}/><span><strong>เตรียมเอกสารให้ครบ</strong><small>PDF / JPG / PNG สูงสุด 3 MB ต่อไฟล์</small></span></div>
        <div><ShieldCheck size={23}/><span><strong>PDF ต้องผ่านการรับรอง</strong><small>Admin เซ็นก่อนอนุมัติให้ดาวน์โหลด</small></span></div>
      </section>

      <section className="manual-section manual-framed-section" id="applicant-map">
        <div className="manual-section-heading"><div><span className="manual-kicker">SITE MAP</span><h2>เริ่มต้นจากเมนูไหน?</h2><p>ชื่อเมนูและปุ่มเหล่านี้ตรงกับเว็บไซต์ระบบรับสมัครปัจจุบัน</p></div></div>
        <div className="manual-route-grid">
          {quickLinks.map(({to,label,hint,Icon}) => <Link to={to} key={to} className="manual-route">
            <span className="manual-route-icon"><Icon size={23}/></span>
            <span><strong>{label}</strong><small>{hint}</small></span>
            <ChevronRight size={18}/>
          </Link>)}
        </div>
        <div className="manual-inline-note"><LockKeyhole size={19}/><span>ผู้สมัครใช้เมนู <strong>เข้าสู่ระบบ</strong> ด้วยอีเมลและรหัสผ่าน ส่วนหน้า <strong>Admin</strong> เป็นทางเข้าสำหรับเจ้าหน้าที่ที่ได้รับสิทธิ์เท่านั้น</span></div>
      </section>

      <section className="manual-section manual-framed-section" id="applicant-wizard">
        <div className="manual-section-heading"><div><span className="manual-kicker">APPLICATION WIZARD</span><h2>วิธีกรอกใบสมัคร 6 ขั้นตอน</h2><p>เมื่อเข้าตำแหน่งที่เปิดรับ กด «ดูรายละเอียด» และ «สมัครตำแหน่งนี้» จากนั้นทำตามลำดับหน้าจอ</p></div></div>
        <div className="manual-steps manual-six-grid">
          {wizardSteps.map(({number,title,detail,points,Icon})=> <article className="manual-step" key={number}>
            <div className="manual-step-top"><span className="manual-step-number">{number}</span><span className="manual-step-icon"><Icon size={25}/></span></div>
            <h3>{title}</h3><p className="manual-step-summary">{detail}</p>
            <ul>{points.map(p=><li key={p}>{p}</li>)}</ul>
          </article>)}
        </div>
        <div className="manual-step-callout"><FileCheck2 size={21}/><div><strong>บันทึกแบบร่าง ≠ ส่งใบสมัคร</strong><p>หากยังไม่กด «ยืนยันส่งใบสมัคร» ข้อมูลยังเป็นแบบร่าง หากมีค่าธรรมเนียม ต้องแนบสลิปและส่งหลักฐานก่อนเข้าขั้นตรวจทาน</p></div></div>
      </section>

      <section className="manual-section manual-framed-section" id="applicant-after">
        <div className="manual-section-heading"><div><span className="manual-kicker">AFTER SUBMISSION</span><h2>ส่งใบสมัครแล้ว ต้องทำอะไรต่อ?</h2><p>ติดตามสถานะผ่านบัญชีของคุณ ไม่ต้องสมัครซ้ำเมื่ออยู่ระหว่างการตรวจ</p></div><Link className="manual-step-link" to="/dashboard">ไปที่ใบสมัครของฉัน <ArrowRight size={16}/></Link></div>
        <div className="manual-after-grid">
          {afterSteps.map(({title,description,Icon},i)=> <article className="manual-after-item" key={title}>
            <span className="manual-after-num">{i+1}</span><Icon size={21}/><strong>{title}</strong><p>{description}</p>
          </article>)}
        </div>
        <div className="manual-inline-note"><Printer size={19}/><span><strong>สำคัญ:</strong> ปุ่มดาวน์โหลดใบสมัคร PDF จะเปิดเฉพาะหลัง Admin ลงลายเซ็นรับรองและกดยืนยันให้ดาวน์โหลดแล้วเท่านั้น ส่วนใบรับชำระเงินเป็นเอกสารอีกประเภทหนึ่ง</span></div>
      </section>

      <section className="manual-section manual-help-grid" id="applicant-faq">
        <div className="manual-faq-card">
          <div className="manual-section-heading"><div><span className="manual-kicker">HELP CENTER</span><h2><HelpCircle size={24}/> คำถามที่พบบ่อย</h2></div></div>
          <div className="manual-faq-list">{faq.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        </div>
        <aside className="manual-contact-card" id="applicant-contact">
          <span className="manual-kicker">CONTACT HR</span><h2>ติดต่อเจ้าหน้าที่</h2>
          <p>หากไม่พบประกาศ ส่งเอกสารไม่สำเร็จ หรือมีปัญหาด้านใบสมัคร โปรดติดต่อผ่านช่องทางที่หน่วยงานกำหนด</p>
          <div className="manual-contact-items">
            <div><ShieldCheck size={19}/><span>{contact?.department || "แผนกงานบริหารงานบุคคล"}</span></div>
            {contact?.address && <div><MapPin size={19}/><span>{contact.address}</span></div>}
            {contact?.hours && <div><CalendarDays size={19}/><span>{contact.hours}</span></div>}
            {contact?.phone && <div><Phone size={19}/><span>{contact.phone}</span></div>}
            {contact?.email && <div><Mail size={19}/><span>{contact.email}</span></div>}
            {settings.error && <small>ไม่สามารถโหลดช่องทางติดต่อได้ในขณะนี้</small>}
            {!settings.isPending && !contact?.phone && !contact?.email && <small>โทรศัพท์และอีเมลจะแสดงเมื่อผู้ดูแลกำหนด</small>}
          </div>
          <Link className="btn manual-contact-btn" to="/announcements">อ่านข่าวและประกาศ <ArrowRight size={17}/></Link>
        </aside>
      </section>
    </div>
  );
}
