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
  Notice,
  Badge,
  Textarea,
  Select,
  Submit,
} from "../../components/UI";
import { statuses } from "../../types/models";
export default function Review() {
  const { id } = useParams(),
    auth = useAuth(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
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
    [deadline, setDeadline] = useState("");
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
        title="ตรวจใบสมัคร"
        description={a?.application_number || "แบบร่าง"}
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
            <section className="panel">
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
            <section className="panel">
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
                      {doc.file_name} · อัปโหลด {dateTH(doc.uploaded_at, true)}
                    </small>
                  </div>
                  <PreviewButton path={doc.storage_path} />
                </div>
              ))}
            </section>
            {auth.can("review") &&
              ["submitted", "under_review"].includes(a.status) && (
                <form className="panel stack" onSubmit={submit}>
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
            {auth.can("review") && (
              <section className="panel">
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
          </>
        )}
      </State>
    </>
  );
}
