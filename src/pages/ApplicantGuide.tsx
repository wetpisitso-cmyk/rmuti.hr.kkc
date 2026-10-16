import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BookOpenCheck, BriefcaseBusiness, CalendarDays, CheckCircle2,
  CircleHelp, CreditCard, FileCheck2, FileText, LockKeyhole, Mail,
  MapPin, Phone, Printer, ShieldCheck, UploadCloud, UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { rows } from "../services/api";

type ManualStep = {
  n: string;
  title: string;
  summary: string;
  points: string[];
  Icon: LucideIcon;
  to?: string;
  action?: string;
};
const steps: ManualStep[] = [
  {
    n: "01", title: "เลือกตำแหน่งที่เปิดรับสมัคร",
    summary: "ตรวจสอบคุณสมบัติ รอบรับสมัคร และระยะเวลาก่อนสมัคร",
    points: ["ไปที่เมนู «ตำแหน่งเปิดรับ» แล้วเลือกสายวิชาการหรือสายสนับสนุน", "คลิก «ดูรายละเอียด» เพื่อตรวจคุณสมบัติ ค่าธรรมเนียม และรายการเอกสารเฉพาะตำแหน่ง", "ระบบเปิดรับตามวันเวลาของแต่ละรอบที่มหาวิทยาลัยประกาศ"],
    Icon: BriefcaseBusiness, to: "/", action: "ดูตำแหน่งที่เปิดรับ",
  },
  {
    n: "02", title: "สมัครสมาชิกและเข้าสู่ระบบ",
    summary: "ใช้บัญชีส่วนตัวสำหรับจัดการใบสมัครและติดตามผล",
    points: ["เลือก «สมัครสมาชิก» กรอกคำนำหน้า ชื่อ นามสกุล เบอร์โทร อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร", "อ่านและยอมรับนโยบายข้อมูลส่วนบุคคลก่อนสร้างบัญชี", "เข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ลงทะเบียน ไม่ต้องสมัครบัญชีใหม่ทุกครั้ง"],
    Icon: UserRound, to: "/register", action: "สร้างบัญชีผู้สมัคร",
  },
  {
    n: "03", title: "กรอกข้อมูลในใบสมัคร",
    summary: "บันทึกข้อมูลทีละขั้นและตรวจให้ตรงกับเอกสาร",
    points: ["เลือกตำแหน่ง แล้วกรอกข้อมูลส่วนตัวตามที่ระบบกำหนด", "กรอกประวัติการศึกษา และประสบการณ์ทำงาน (ถ้ามี)", "สามารถบันทึกแบบร่างและกลับมาทำต่อได้ก่อนส่งใบสมัคร"],
    Icon: FileText, to: "/dashboard", action: "ไปที่ใบสมัครของฉัน",
  },
  {
    n: "04", title: "แนบไฟล์เอกสาร",
    summary: "อัปโหลดเฉพาะประเภทไฟล์และเอกสารที่กำหนด",
    points: ["แนบรูปถ่ายเป็น JPG/PNG ส่วนเอกสารอื่นใช้ PDF/JPG/PNG", "ไฟล์ใหม่ทุกไฟล์รวมถึงสลิปชำระเงินต้องมีขนาดไม่เกิน 3 MB ต่อไฟล์", "เอกสารที่มีเครื่องหมาย * เป็นเอกสารบังคับ ตรวจให้ภาพชัด อ่านข้อความได้ครบ"],
    Icon: UploadCloud,
  },
  {
    n: "05", title: "ตรวจทานและยืนยันส่งใบสมัคร",
    summary: "ส่งจริงหลังตรวจสอบชื่อ ตำแหน่ง และเอกสารให้ครบถ้วน",
    points: ["ตรวจข้อมูลส่วนตัว ประวัติ และรายการไฟล์แนบอีกครั้ง", "อ่านและกดยอมรับนโยบายตามที่ระบบแสดง", "กดส่งใบสมัคร แล้วกลับมาติดตามสถานะที่ «ใบสมัครของฉัน»"],
    Icon: FileCheck2,
  },
  {
    n: "06", title: "ชำระเงินเมื่อประกาศกำหนด",
    summary: "ไม่ใช่ทุกตำแหน่งจะต้องชำระค่าธรรมเนียม",
    points: ["ถ้ามีค่าธรรมเนียม ให้ทำตามคำแนะนำการชำระเงินที่แสดงในใบสมัคร", "อัปโหลดหลักฐานชำระเงิน พร้อมกรอกยอดและวันเวลาให้ถูกต้อง", "การส่งสลิปไม่เท่ากับชำระเงินผ่านการตรวจสอบ ต้องรอเจ้าหน้าที่ยืนยัน"],
    Icon: CreditCard,
  },
  {
    n: "07", title: "ติดตามสถานะและเลขผู้สมัคร",
    summary: "ตรวจผลการดำเนินการจากบัญชีของตนเอง",
    points: ["เปิด «ใบสมัครของฉัน» เพื่อดูความคืบหน้าและเลขผู้สมัครเมื่อ Admin กำหนด", "หากขึ้น «ต้องแก้ไข» ให้เปิดใบสมัครและแก้ตามคำแนะนำของเจ้าหน้าที่", "เลขผู้สมัครออกโดย Admin อาจเป็นภาษาไทย อังกฤษ หรือตัวเลข และไม่จำเป็นต้องเรียงอัตโนมัติ"],
    Icon: CheckCircle2, to: "/dashboard", action: "ติดตามใบสมัคร",
  },
  {
    n: "08", title: "ดาวน์โหลดใบสมัครและติดตามผลสอบ",
    summary: "รอการรับรองและประกาศของมหาวิทยาลัย",
    points: ["ใบสมัคร PDF จะพิมพ์หรือบันทึกได้ต่อเมื่อ Admin กดยืนยันให้ดาวน์โหลดแล้ว", "หากระบบยังไม่เปิดให้พิมพ์ ให้รอการยืนยันจาก Admin ไม่ต้องส่งใบสมัครซ้ำ", "ติดตามกำหนดสอบ บัตรสอบ (เมื่อมีการเผยแพร่) และผลคัดเลือกจากเมนูประกาศ"],
    Icon: Printer, to: "/results", action: "ดูผลคัดเลือก",
  },
];

const faq = [
  ["ต้องใช้เอกสารอะไรบ้าง?", "เอกสารบังคับและเอกสารเพิ่มเติมขึ้นอยู่กับแต่ละตำแหน่ง กรุณาอ่านหน้ารายละเอียดตำแหน่งก่อนอัปโหลด"],
  ["ไฟล์ 3 MB หมายถึงรวมทั้งหมดหรือไม่?", "หมายถึงไม่เกิน 3 MB ต่อไฟล์ เช่น รูปถ่ายหนึ่งไฟล์ และ PDF หนึ่งไฟล์ต่างต้องมีขนาดไม่เกิน 3 MB หากไฟล์ใหญ่ ให้บีบอัดโดยยังคงความคมชัด"],
  ["ส่งใบสมัครแล้วแก้ไขได้ไหม?", "แก้ไขได้เมื่อใบสมัครอยู่สถานะที่ระบบอนุญาต เช่น «ต้องแก้ไข» และเจ้าหน้าที่ให้แก้ตามรายการที่แจ้ง"],
  ["ทำไมยังไม่มีเลขผู้สมัคร?", "เลขผู้สมัครไม่ได้ออกอัตโนมัติ Admin จะตรวจและกำหนดเลขให้ตามขั้นตอนของรอบนั้น ๆ"],
  ["ทำไมพิมพ์หรือดาวน์โหลดใบสมัคร PDF ไม่ได้?", "ระบบจะให้พิมพ์ได้หลัง Admin กด «ยืนยันให้ดาวน์โหลดใบสมัคร» แล้วเท่านั้น กรุณาตรวจสถานะภายหลัง"],
  ["แนบสลิปแล้วทำไมยังไม่ขึ้นยืนยันชำระเงิน?", "หลักฐานชำระเงินต้องผ่านการตรวจสอบจากเจ้าหน้าที่ก่อน จึงจะเปลี่ยนสถานะเป็นยืนยันแล้ว"],
  ["ลืมรหัสผ่านต้องทำอย่างไร?", "เปิดหน้าเข้าสู่ระบบแล้วเลือก «ลืมรหัสผ่าน» กรอกอีเมลที่สมัครไว้ และทำตามลิงก์ตั้งรหัสผ่านใหม่ที่ได้รับ"],
  ["สมัครผ่านโทรศัพท์มือถือได้ไหม?", "ใช้งานได้ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์ โดยควรเตรียมเอกสารที่อ่านได้ชัดเจนและตรวจข้อมูลก่อนกดส่ง"],
];

export default function ApplicantGuide() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const contact = settings.data?.find((x) => x.key === "contact")?.value;
  return (
    <div className="container manual-page applicant-guide">
      <header className="manual-hero">
        <div className="manual-hero-content">
          <span className="manual-eyebrow"><BookOpenCheck size={17} /> APPLICANT HANDBOOK · RMUTI KKC</span>
          <h1>คู่มือการใช้งาน<br /><span>สำหรับผู้สมัคร</span></h1>
          <p>สมัครสมาชิก กรอกใบสมัคร แนบเอกสาร และติดตามผลด้วยตนเอง ตั้งแต่เริ่มต้นจนเสร็จสิ้นการรับสมัคร</p>
          <div className="manual-hero-actions">
            <Link className="btn manual-light-btn" to="/register"><UserRound size={18} /> สมัครสมาชิก <ArrowRight size={17} /></Link>
            <Link className="btn manual-ghost-btn" to="/login"><LockKeyhole size={18} /> เข้าสู่ระบบ</Link>
          </div>
        </div>
        <div className="manual-hero-art" aria-hidden="true">
          <div className="manual-art-icon"><BookOpenCheck size={78} strokeWidth={1.5} /></div>
          <span className="manual-art-label"><ShieldCheck size={16} /> คู่มืออย่างเป็นทางการของระบบ</span>
        </div>
      </header>

      <section className="manual-info-banner" aria-label="สิ่งที่ควรเตรียม">
        <div><FileCheck2 size={23} /><span><strong>เตรียมเอกสารให้พร้อม</strong><small>อ่านรายการเอกสารที่ตำแหน่งกำหนด</small></span></div>
        <div><UploadCloud size={23} /><span><strong>ไฟล์ไม่เกิน 3 MB</strong><small>ต่อไฟล์ · PDF / JPG / PNG</small></span></div>
        <div><ShieldCheck size={23} /><span><strong>ดาวน์โหลด PDF หลัง Admin ยืนยัน</strong><small>ตรวจสถานะในบัญชีผู้สมัคร</small></span></div>
      </section>

      <section className="manual-section" id="applicant-steps">
        <div className="manual-section-heading"><div><span className="manual-kicker">HOW TO APPLY</span><h2>ขั้นตอนการสมัคร 8 ขั้นตอน</h2><p>ทำตามลำดับได้เลย แต่ละขั้นอ้างอิงการใช้งานในเว็บไซต์จริง</p></div></div>
        <div className="manual-steps">
          {steps.map(({ n, title, summary, points, Icon, to, action }) => (
            <article className="manual-step" key={n}>
              <div className="manual-step-top"><span className="manual-step-number">{n}</span><span className="manual-step-icon"><Icon size={25} /></span></div>
              <h3>{title}</h3>
              <p className="manual-step-summary">{summary}</p>
              <ul>{points.map((point) => <li key={point}>{point}</li>)}</ul>
              {to && <Link className="manual-step-link" to={to}>{action} <ArrowRight size={16} /></Link>}
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section manual-help-grid" id="applicant-help">
        <div className="manual-faq-card">
          <div className="manual-section-heading"><div><span className="manual-kicker">HELP CENTER</span><h2><CircleHelp size={25} /> คำถามที่พบบ่อย</h2></div></div>
          <div className="manual-faq-list">
            {faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </div>
        <aside className="manual-contact-card">
          <span className="manual-kicker">CONTACT US</span>
          <h2>ติดต่อเจ้าหน้าที่</h2>
          <p>หากพบปัญหาการใช้งาน โปรดติดต่อหน่วยงานตามช่องทางที่กำหนดในระบบ</p>
          <div className="manual-contact-items">
            <div><ShieldCheck size={19} /><span>{contact?.department || "แผนกงานบริหารงานบุคคล"}</span></div>
            {contact?.address && <div><MapPin size={19} /><span>{contact.address}</span></div>}
            {contact?.hours && <div><CalendarDays size={19} /><span>{contact.hours}</span></div>}
            {contact?.phone && <div><Phone size={19} /><span>{contact.phone}</span></div>}
            {contact?.email && <div><Mail size={19} /><span>{contact.email}</span></div>}
            {settings.error && <small>ไม่สามารถโหลดข้อมูลติดต่อในขณะนี้ กรุณาลองใหม่</small>}
            {!settings.isPending && !contact?.phone && !contact?.email && <small>โทรศัพท์และอีเมลจะแสดงเมื่อผู้ดูแลระบบกำหนด</small>}
          </div>
          <Link className="btn manual-contact-btn" to="/announcements">ดูประกาศล่าสุด <ArrowRight size={17}/></Link>
        </aside>
      </section>
    </div>
  );
}
