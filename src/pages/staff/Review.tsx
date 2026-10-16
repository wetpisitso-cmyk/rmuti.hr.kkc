import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApplication, rpc } from "../../services/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { dateTH, bangkokISO, money } from "../../lib/format";
import { errorTH } from "../../lib/errors";
import { ThaiDateField } from "../../components/ThaiDateField";
import { PreviewButton } from "../../components/DocumentUpload";
import {
  State,
  Title,
  Field,
  Notice,
  Badge,
  Textarea,
  Select,
  Submit,
} from "../../components/UI";
import { statuses } from "../../types/models";
import { AdminSignaturePad, type AdminSignature } from "../../components/AdminSignaturePad";
export default function Review() {
  const { id } = useParams(),
    auth = useAuth(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
  });
  const signature = useQuery({
    queryKey: ["admin-signature", id],
    queryFn: async () => { const r = await supabase.from("application_admin_signatures").select("*").eq("application_id", id).maybeSingle(); if(r.error)throw r.error; return r.data as AdminSignature | null; },
  });
  const printApproval = useQuery({
    queryKey: ["print-approved", id],
    enabled: !!id,
    queryFn: async () => { const r = await supabase.from("application_print_approvals").select("*").eq("application_id",id).maybeSingle();if(r.error) throw r.error;return r.data; },
  });
  const canPrint = useQuery({
    queryKey: ["can-print-application", id],
    enabled: !!id,
    queryFn: () => rpc<boolean>("can_print_application", {p_id:id}),
  });
  const notes = useQuery({
    queryKey: ["staff-notes", id],
    queryFn: async () => {
      const r = await supabase
        .from("staff_notes")
        .select("id,note,created_at,author_id")
        .eq("application_id", id)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [next, setNext] = useState("under_review"),
    [deadline, setDeadline] = useState(""),
    [assignedNumber, setAssignedNumber] = useState("");
  const d = q.data,
    a = d?.application;
  const actualNext =
    a?.status === "submitted"
      ? "under_review"
      : next === "under_review"
        ? "eligible"
        : next;
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["application", id] });
    await qc.invalidateQueries({ queryKey: ["staff-list"] });
    await qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
    await qc.invalidateQueries({ queryKey: ["admin-signature", id] });
    await qc.invalidateQueries({ queryKey: ["print-approved", id] });
    await qc.invalidateQueries({ queryKey: ["can-print-application", id] });
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await rpc("review_application", {
        p_id: id,
        p_status: actualNext,
        p_message: f.message || "",
        p_deadline:
          actualNext === "needs_correction"
            ? bangkokISO(String(f.deadline))
            : null,
      });
      await refresh();
      setSuccess("บันทึกผลตรวจแล้ว");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  const assignNumber = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (auth.role !== "admin" || !a) return;
    setBusy(true);
    setError("");
    try {
      await rpc("admin_assign_application_number", { p_id: id, p_number: assignedNumber.trim() });
      await refresh();
      await qc.invalidateQueries({ queryKey: ["my-applications"] });
      setSuccess("บันทึกเลขผู้สมัครแล้ว โปรดยืนยันให้ดาวน์โหลดใบสมัครแยกต่างหาก");
    } catch (e) { setError(errorTH(e)); }
    finally { setBusy(false); }
  };
  const approvePrint = async () => {
    if(auth.role!=="admin" || !a?.application_number) return;
    if(!window.confirm("ยืนยันให้ผู้สมัครดาวน์โหลดใบสมัคร PDF เลขที่ "+a.application_number+" ?")) return;
    setBusy(true);setError("");setSuccess("");
    try {
      await rpc("admin_confirm_application_print",{p_id:id,p_confirm:true});
      await refresh();
      setSuccess("ยืนยันใบสมัครแล้ว ผู้สมัครสามารถดาวน์โหลด PDF ได้");
    } catch(e){setError(errorTH(e));}finally{setBusy(false);}
  };
  const note = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = new FormData(form).get("note");
    setBusy(true);
    setError("");
    try {
      const r = await supabase
        .from("staff_notes")
        .insert({
          application_id: id,
          author_id: auth.session!.user.id,
          note: text,
        });
      if (r.error) throw r.error;
      form.reset();
      await qc.invalidateQueries({ queryKey: ["staff-notes", id] });
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  const payment = async (e: FormEvent<HTMLFormElement>, paymentId: string) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await rpc("review_payment", {
        p_id: paymentId,
        p_confirm: f.decision === "confirmed",
        p_reason: f.reason || "",
      });
      await refresh();
      setSuccess("บันทึกผลตรวจการชำระเงินแล้ว");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title
        title="รายละเอียดใบสมัคร"
        description={a?.application_number || (a?.submitted_at ? "รอ Admin กำหนดเลขผู้สมัคร" : "แบบร่าง")}
        action={
          <Link className="btn outline" to={`/application/${id}`}>
            เปิดข้อมูลและใบสมัคร A4
          </Link>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <State loading={q.isPending} error={q.error}>
        {a && d && (
          <>
            <section className="review-overview panel no-print">
              <div className="review-overview-top">
                <div>
                  <span className="eyebrow">APPLICATION REVIEW</span>
                  <h2>{a.personal_data.prefix}{a.personal_data.first_name} {a.personal_data.last_name}</h2>
                  <p>{a.application_number || "รอ Admin กำหนดเลขผู้สมัคร"}</p>
                </div>
                <div className="review-status-tags">
                  <Badge status={a.status} />
                  <Badge status={a.payment_status} payment />
                </div>
              </div>
              <div className="review-metrics">
                <div><span>เอกสารที่แนบ</span><strong>{d.documents.length}</strong><small>รายการ</small></div>
                <div><span>ประวัติการศึกษา</span><strong>{d.education.length}</strong><small>รายการ</small></div>
                <div><span>ประสบการณ์ทำงาน</span><strong>{d.experience.length}</strong><small>รายการ</small></div>
                <div><span>เลขผู้สมัคร</span><strong>{a.application_number ? "ได้รับแล้ว" : "รอกำหนด"}</strong></div>
              </div>
              <nav className="review-jump-links" aria-label="ไปยังส่วนของการตรวจใบสมัคร">
                <a href="#review-personal">ข้อมูลผู้สมัคร</a>
                <a href="#review-documents">เอกสารแนบ</a>
                <a href="#review-decision">ผลการตรวจ</a>
                <a href="#review-notes">บันทึกเจ้าหน้าที่</a>
              </nav>
            </section>
            <div className="apple-review-columns">
            <section className="panel" id="review-personal">
              <div className="flex gap-2">
                <Badge status={a.status} />
                <Badge status={a.payment_status} payment />
              </div>
              <h2 className="mt-4">
                {a.personal_data.prefix}
                {a.personal_data.first_name} {a.personal_data.last_name}
              </h2>
              <p>
                {a.job_positions?.title} · {a.job_positions?.departments?.name}
              </p>
              <p>
                โทรศัพท์ {a.personal_data.phone} · วันเกิด{" "}
                {dateTH(a.personal_data.birth_date)}
              </p>
              <p>ที่อยู่ {a.personal_data.address}</p>
              <h3 className="mt-4">การศึกษาและประสบการณ์</h3>
              {d.education.map((e, i) => (
                <p key={i}>
                  {e.degree} {e.major} · {e.institution} · ปี{" "}
                  {e.graduation_year} · GPA {e.gpa}
                </p>
              ))}
              {d.experience.map((e, i) => (
                <p key={i}>
                  {e.position} · {e.employer}
                  <br />
                  {e.details}
                </p>
              ))}
            </section>
            {auth.role === "admin" && a.submitted_at && (
              <form className="panel stack" onSubmit={assignNumber}>
                <h2>ออกเลขผู้สมัครโดย Admin</h2>
                <Notice>กำหนดเลขได้เองทั้งภาษาไทย ภาษาอังกฤษ ตัวเลขและเครื่องหมาย เช่น รับสมัคร/๒๕๖๙/๑ หรือ HR-2569-A1 โดยห้ามซ้ำกับใบสมัครอื่น</Notice>
                <Field label="เลขผู้สมัคร (กรอกเอง)" value={assignedNumber}
                  onChange={e => setAssignedNumber(e.target.value)}
                  placeholder={a.application_number || "มทร.ขก./๒๕๖๙/๐๐๑"}
                  required maxLength={80} />
                <Submit busy={busy}>{a.application_number ? "เปลี่ยนเลขผู้สมัคร" : "ยืนยันออกเลขผู้สมัคร"}</Submit>
              </form>
            )}
            {auth.role === "admin" && a.submitted_at && (
              <section className="panel stack" id="review-print-approval">
                <h2>ยืนยันให้ผู้สมัครดาวน์โหลดใบสมัคร PDF</h2>
                <p className="muted">Admin ตรวจเอกสารและเลขผู้สมัครแล้วจึงกดยืนยัน ผู้สมัครยังดาวน์โหลดไม่ได้ก่อนยืนยัน</p>
                {printApproval.data && canPrint.data ? (
                  <Notice kind="success">อนุมัติให้พิมพ์ใบสมัครแล้ว</Notice>
                ) : (
                  <Notice>ยังไม่อนุมัติ PDF ผู้สมัครจะไม่เห็นเอกสารฉบับพิมพ์</Notice>
                )}
                <button type="button" className="btn primary" disabled={busy || !a.application_number || ["draft","needs_correction","withdrawn"].includes(a.status) || Boolean(printApproval.data && canPrint.data)}
                  onClick={() => void approvePrint()}>
                  ยืนยันให้ดาวน์โหลดใบสมัคร
                </button>
              </section>
            )}
            <section className="panel" id="review-documents">
              <h2>ตรวจเอกสารแนบ</h2>
              {d.documents.map((doc) => (
                <div className="document-row" key={doc.id}>
                  <div>
                    <strong>
                      {a.job_positions?.required_documents.find(
                        (r) => r.key === doc.document_type,
                      )?.label || doc.document_type}
                    </strong>
                    <small>
                      {doc.file_name} · {Math.round(doc.size_bytes / 1024).toLocaleString("th-TH")} KB · อัปโหลด {dateTH(doc.uploaded_at, true)}
                    </small>
                  </div>
                  <PreviewButton path={doc.storage_path} />
                </div>
              ))}
            </section>
            {auth.can("review") &&
              ["submitted", "under_review"].includes(a.status) && (
                <form className="panel stack" id="review-decision" onSubmit={submit}>
                  <h2>ผลตรวจคุณสมบัติ</h2>
                  <Select
                    label="สถานะใหม่"
                    value={actualNext}
                    onChange={(e) => setNext(e.target.value)}
                  >
                    {(a.status === "submitted"
                      ? ["under_review"]
                      : [
                          "under_review",
                          "needs_correction",
                          "eligible",
                          "ineligible",
                        ]
                    )
                      .filter((x) => x !== a.status)
                      .map((x) => (
                        <option key={x} value={x}>
                          {statuses[x as keyof typeof statuses]}
                        </option>
                      ))}
                  </Select>
                  <Textarea
                    label="ข้อความที่ผู้สมัครเห็น / รายการเอกสารที่ต้องแก้"
                    name="message"
                    required={["needs_correction", "ineligible"].includes(
                      actualNext,
                    )}
                    maxLength={2000}
                  />
                  {actualNext === "needs_correction" && (
                    <ThaiDateField label="กำหนดแก้ไข (พ.ศ. เวลาไทย)" withTime name="deadline" value={deadline} onChange={setDeadline} required />
                  )}
                  <Submit busy={busy}>บันทึกสถานะและแจ้งผู้สมัคร</Submit>
                </form>
              )}
            {auth.can("payments") &&
              d.payments.map((p) => (
                <section className="panel" key={p.id}>
                  <h2>ตรวจหลักฐานชำระเงิน</h2>
                  <p>
                    {money(Number(p.amount))} · {dateTH(p.paid_at, true)} ·
                    อ้างอิง {p.reference || "ไม่ระบุ"}
                  </p>
                  <Badge status={p.status} payment />
                  <div className="mt-3">
                    <PreviewButton path={p.slip_path} />
                  </div>
                  {p.status === "pending" && (
                    <form
                      onSubmit={(e) => payment(e, p.id)}
                      className="stack mt-4"
                    >
                      <Select label="ผลตรวจ" name="decision">
                        <option value="confirmed">ยืนยันแล้ว</option>
                        <option value="rejected">ปฏิเสธ / ต้องแก้ไข</option>
                      </Select>
                      <Textarea
                        label="เหตุผล (จำเป็นเมื่อปฏิเสธ)"
                        name="reason"
                        maxLength={2000}
                      />
                      <Submit busy={busy}>บันทึกผลตรวจสลิป</Submit>
                    </form>
                  )}
                </section>
              ))}
            {auth.role === "admin" && <AdminSignaturePad applicationId={id!} existing={signature.data || null} eligible={a.status === "eligible" && !!a.application_number && ["confirmed","not_required"].includes(a.payment_status)} refresh={refresh} />}
            {auth.can("review") && (
              <section className="panel" id="review-notes">
                <h2>บันทึกภายในของเจ้าหน้าที่</h2>
                <small className="muted">
                  ผู้สมัครไม่สามารถอ่านบันทึกส่วนนี้
                </small>
                <form className="stack mt-4" onSubmit={note}>
                  <Textarea
                    label="เพิ่มบันทึก"
                    name="note"
                    required
                    maxLength={4000}
                  />
                  <Submit busy={busy}>เพิ่มบันทึก</Submit>
                </form>
                <State loading={notes.isPending} error={notes.error}>
                  {notes.data?.map((n) => (
                    <div className="subpanel mt-3" key={n.id}>
                      <p className="pre-wrap">{n.note}</p>
                      <small>{dateTH(n.created_at, true)}</small>
                    </div>
                  ))}
                </State>
              </section>
            )}
            </div>
          </>
        )}
      </State>
    </>
  );
}
