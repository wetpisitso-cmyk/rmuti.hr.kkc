import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, FileDown } from "lucide-react";
import { rpc } from "../../services/api";
import { errorTH } from "../../lib/errors";
import { Notice, State } from "../../components/UI";
import { examCardForExport, type ExamCardListing } from "../../lib/exam-card-data";
import { downloadExamCard, makeExamCardPdf } from "../../lib/exam-card-pdf";

type Props = {
  applicationId: string;
  enabled: boolean;
};

export default function ExamCardApprovalStep({ applicationId, enabled }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"issue" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const list = useQuery({
    queryKey: ["exam-card-review-list", applicationId],
    queryFn: () => rpc<ExamCardListing[]>("exam_card_list", { p_round: null }),
    enabled,
    staleTime: 0,
  });
  const assignments = (list.data || []).filter((x) => x.application_id === applicationId);
  async function approve(assignmentId: string) {
    if (busy || !window.confirm("ยืนยันอนุมัติออกบัตรประจำตัวผู้สมัครสอบ A4 ให้ผู้สมัครรายนี้?")) return;
    setError("");
    setSuccess("");
    setBusy("issue");
    try {
      // Security conditions are enforced by the existing Supabase admin RPC.
      await rpc("admin_exam_card_issue", { p_assignment: assignmentId, p_confirm: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["exam-card-review-list", applicationId] }),
        queryClient.invalidateQueries({ queryKey: ["exam-card-list"] }),
        queryClient.invalidateQueries({ queryKey: ["my-issued-exam-cards"] }),
      ]);
      setSuccess("อนุมัติออกบัตรสอบเรียบร้อยแล้ว ผู้สมัครสามารถเข้าบัญชีเพื่อดาวน์โหลดได้");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(null);
    }
  }
  async function download(assignmentId: string) {
    if (busy) return;
    setError("");
    setBusy("pdf");
    try {
      // Read back through the authorized RPC to verify issuance and card validity.
      const item = await examCardForExport(assignmentId);
      if (item.card.application_id !== applicationId) throw new Error("CARD_APPLICATION_MISMATCH");
      const pdf = await makeExamCardPdf([item]);
      const name = item.card.exam_number.replace(/[^a-zA-Z0-9ก-๙_-]/g, "-");
      downloadExamCard(pdf, "ExamCard_" + name + ".pdf");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel stack review-color-panel tone-teal" id="review-exam-card-approval">
      <h2><CreditCard size={21} /> อนุมัติออกบัตรประจำตัวผู้สมัครสอบ (A4)</h2>
      <p className="muted">
        ขั้นตอนนี้แยกจากการอนุมัติ PDF ใบสมัคร เมื่ออนุมัติบัตรสอบแล้ว
        ผู้สมัครจะเห็นปุ่มดาวน์โหลดบัตรในหน้าใบสมัครของฉัน โดยใช้ลายเซ็นเจ้าหน้าที่ที่รับรองไว้แล้ว
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <State loading={list.isPending} error={list.error}>
        {!assignments.length ? (
          <div className="subpanel stack">
            <Notice>ยังไม่มีเลขประจำตัวสอบที่ผูกกับกำหนดสอบสำหรับใบสมัครนี้ กรุณาจัดกำหนดสอบและออกเลขสอบก่อน</Notice>
            <Link className="btn outline" to="/staff/exams">ไปกำหนดสอบ / ออกเลขประจำตัวสอบ</Link>
          </div>
        ) : assignments.map((card) => {
          const active = card.card_current && card.schedule_published;
          const stale = !!card.issued_at && !card.revoked_at && !card.card_current;
          const ready = card.schedule_published && card.has_photo &&
            card.has_signature && card.rules_approved;
          return (
            <div className="subpanel stack" key={card.assignment_id}>
              <p><strong>เลขประจำตัวสอบ:</strong> {card.exam_number}</p>
              <p><strong>รอบ:</strong> {card.round_name} · {card.issue_label}</p>
              {active ? (
                <>
                  <Notice kind="success"><CheckCircle2 size={17}/> อนุมัติออกบัตรสอบแล้ว ผู้สมัครดาวน์โหลดได้จาก Dashboard</Notice>
                  <button className="btn outline" type="button" disabled={!!busy}
                    onClick={() => void download(card.assignment_id)}>
                    <FileDown size={17}/> {busy === "pdf" ? "กำลังสร้าง PDF…" : "ดาวน์โหลดบัตรสอบ PDF เพื่อตรวจสอบ"}
                  </button>
                </>
              ) : stale ? (
                <Notice kind="error">ข้อมูลบัตรเดิมเปลี่ยนแปลง ต้องยกเลิกบัตรเดิมและตรวจสอบก่อนออกใหม่</Notice>
              ) : (
                <>
                  {!ready && <Notice>
                    ยังไม่พร้อมออกบัตร: {!card.schedule_published ? "ต้องเผยแพร่กำหนดสอบ " : ""}
                    {!card.has_photo ? "ไม่มีรูปถ่าย " : ""}
                    {!card.has_signature ? "ลายเซ็นหรือการอนุมัติ PDF ใบสมัครไม่ครบ " : ""}
                    {!card.rules_approved ? "ยังไม่อนุมัติข้อปฏิบัติสำหรับเข้าสอบ" : ""}
                  </Notice>}
                  <button className="btn primary" type="button" disabled={!!busy || !ready || !enabled}
                    onClick={() => void approve(card.assignment_id)}>
                    <CreditCard size={17}/> {busy === "issue" ? "กำลังอนุมัติ…" : "อนุมัติออกบัตรประจำตัวผู้สมัครสอบ"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </State>
      <Link className="btn outline small" to="/staff/exam-cards">
        จัดการบัตรสอบทั้งหมด / อนุมัติข้อความข้อปฏิบัติ
      </Link>
    </section>
  );
}
