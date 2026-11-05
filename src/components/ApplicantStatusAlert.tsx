import { Link } from "react-router-dom";
import {
  AlertCircle, ArrowRight, CheckCircle2, Clock3, FilePenLine,
  Send, XCircle, CircleMinus, Bell, type LucideIcon,
} from "lucide-react";
import { dateTH } from "../lib/format";
import type { Application, AppStatus } from "../types/models";

type StatusStyle = {
  title: string;
  description: string;
  tone: "info" | "warning" | "success" | "danger" | "neutral";
  Icon: LucideIcon;
};
const descriptions: Record<AppStatus, StatusStyle> = {
  draft: {
    title: "ยังไม่ได้ส่งใบสมัคร",
    description: "กรุณาตรวจสอบข้อมูลและส่งใบสมัครให้เรียบร้อย",
    tone: "neutral", Icon: FilePenLine,
  },
  submitted: {
    title: "รับใบสมัครแล้ว",
    description: "ระบบได้รับใบสมัครเรียบร้อย กำลังรอเจ้าหน้าที่ตรวจสอบ",
    tone: "info", Icon: Send,
  },
  under_review: {
    title: "อยู่ระหว่างตรวจสอบ",
    description: "เจ้าหน้าที่กำลังตรวจสอบข้อมูลและเอกสารของคุณ",
    tone: "info", Icon: Clock3,
  },
  needs_correction: {
    title: "ต้องแก้ไขข้อมูลหรือเอกสาร",
    description: "กรุณาอ่านข้อความจากเจ้าหน้าที่ด้านล่างและแก้ไขตามกำหนด",
    tone: "warning", Icon: AlertCircle,
  },
  eligible: {
    title: "ผ่านการตรวจสอบคุณสมบัติ",
    description: "ผ่านคุณสมบัติแล้ว กรุณาติดตามกำหนดสอบและการออกบัตรสอบผ่านระบบ",
    tone: "success", Icon: CheckCircle2,
  },
  ineligible: {
    title: "ไม่ผ่านการตรวจสอบคุณสมบัติ",
    description: "กรุณาตรวจสอบเหตุผลที่เจ้าหน้าที่แจ้งและประกาศอย่างเป็นทางการ",
    tone: "danger", Icon: XCircle,
  },
  withdrawn: {
    title: "ถอนใบสมัครแล้ว",
    description: "ใบสมัครนี้ถูกถอนจากการดำเนินการ",
    tone: "neutral", Icon: CircleMinus,
  },
};

export default function ApplicantStatusAlert({
  application, detail = false, hasExamCard = false,
}: {
  application: Application;
  detail?: boolean;
  hasExamCard?: boolean;
}) {
  const info = descriptions[application.status] || descriptions.under_review;
  const Icon = info.Icon;
  const needsAction = application.status === "needs_correction";
  const showStaffMessage = Boolean(application.public_message?.trim()) &&
    ["needs_correction", "ineligible", "under_review"].includes(application.status);
  return (
    <section className={`applicant-status-alert tone-${info.tone}`}
      role={needsAction ? "alert" : "status"} aria-label={`สถานะใบสมัคร: ${info.title}`}>
      <div className="applicant-status-top">
        <span className="applicant-status-icon"><Icon size={24} aria-hidden="true" /></span>
        <div className="applicant-status-copy">
          <small className="applicant-status-eyebrow">สถานะใบสมัครล่าสุด</small>
          <h3>{info.title}</h3>
          <p>{info.description}</p>
          {!detail && <small className="applicant-status-position">
            {application.job_positions?.title || application.snapshot?.job?.title || "ใบสมัครของฉัน"}
          </small>}
        </div>
      </div>
      {showStaffMessage && (
        <div className="applicant-status-staff-message">
          <strong><Bell size={16} aria-hidden="true" /> ข้อความจากเจ้าหน้าที่</strong>
          <p className="pre-wrap">{application.public_message}</p>
        </div>
      )}
      {needsAction && application.correction_deadline && (
        <p className="applicant-status-deadline">
          <AlertCircle size={16} aria-hidden="true" />
          กำหนดแก้ไขภายใน {dateTH(application.correction_deadline, true)}
        </p>
      )}
      <div className="applicant-status-actions">
        {needsAction && (
          <Link className="btn primary small" to={`/application/${application.id}/edit`}>
            แก้ไขใบสมัคร <ArrowRight size={16} />
          </Link>
        )}
        {hasExamCard && application.status === "eligible" && (
          <span className="applicant-status-exam-ready">
            <CheckCircle2 size={16} /> มีบัตรสอบที่ออกแล้ว กรุณาเปิดดูในรายละเอียดใบสมัคร
          </span>
        )}
        {!detail && (
          <Link className="btn outline small" to={`/application/${application.id}`}>
            ดูรายละเอียดและประวัติ <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </section>
  );
}
