import { useState, useEffect, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Printer,
  Pencil,
  FileCheck2,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { getApplication, rpc, rows, signedFile } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import {
  dateTH,
  money,
  bangkokISO,
  bangkokInput,
  printPage,
} from "../lib/format";
import { errorTH } from "../lib/errors";
import {
  Badge,
  Field,
  Select,
  Notice,
  State,
  Title,
  Submit,
} from "../components/UI";
import { DocumentUpload, PreviewButton } from "../components/DocumentUpload";
import { outcomeLabels, statuses } from "../types/models";
export default function ApplicationView() {
  const { id } = useParams(),
    auth = useAuth(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [withdraw, setWithdraw] = useState(false);
  const pay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await rpc("save_payment", {
        p_app: id,
        p_amount: Number(f.amount),
        p_paid: bangkokISO(String(f.paid_at)),
        p_reference: f.reference,
      });
      await qc.invalidateQueries({ queryKey: ["application", id] });
      setSuccess("ส่งหลักฐานชำระเงินแล้ว รอเจ้าหน้าที่ตรวจสอบ");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await rpc("review_application", {
        p_id: id,
        p_status: "withdrawn",
        p_message: "ผู้สมัครถอนใบสมัคร",
      });
      await qc.invalidateQueries({ queryKey: ["application", id] });
      await qc.invalidateQueries({ queryKey: ["my-applications"] });
      setWithdraw(false);
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  const d = q.data,
    a = d?.application,
    j = a?.job_positions || a?.snapshot?.job;
  return (
    <div className="container section">
      <Link
        className="breadcrumb"
        to={auth.role === "applicant" ? "/dashboard" : "/staff/applications"}
      >
        <ArrowLeft size={16} /> กลับรายการใบสมัคร
      </Link>
      <State loading={q.isPending} error={q.error}>
        {a && j && (
          <>
            <Title
              eyebrow={a.application_number || "DRAFT APPLICATION"}
              title={j.title}
              description={j.departments?.name}
              action={
                <div className="flex gap-2 flex-wrap">
                  {["draft", "needs_correction"].includes(a.status) && (
                    <Link
                      className="btn primary"
                      to={`/application/${id}/edit`}
                    >
                      <Pencil size={17} /> แก้ไขใบสมัคร
                    </Link>
                  )}
                  {a.submitted_at && (
                    <Link
                      className="btn outline"
                      to={`/application/${id}/print`}
                    >
                      <Printer size={17} /> ใบสมัคร / PDF
                    </Link>
                  )}
                  {!!d.assignments.length && (
                    <Link
                      className="btn outline"
                      to={`/application/${id}/exam`}
                    >
                      <FileCheck2 size={17} /> บัตรประจำตัวสอบ
                    </Link>
                  )}
                </div>
              }
            />
            {error && <Notice kind="error">{error}</Notice>}
            {success && <Notice kind="success">{success}</Notice>}
            <div className="detail-grid">
              <div>
                <section className="panel">
                  <div className="flex gap-2">
                    <Badge status={a.status} />
                    <Badge status={a.payment_status} payment />
                  </div>
                  {a.application_number && (
                    <h2 className="mt-4">เลขผู้สมัคร {a.application_number}</h2>
                  )}
                  {a.public_message && (
                    <Notice>
                      {a.public_message}
                      {a.correction_deadline &&
                        ` · แก้ไขภายใน ${dateTH(a.correction_deadline, true)}`}
                    </Notice>
                  )}
                  <h3 className="mt-5">ข้อมูลผู้สมัคร</h3>
                  <p>
                    {a.personal_data.prefix}
                    {a.personal_data.first_name} {a.personal_data.last_name}
                  </p>
                  <p>
                    วันเกิด {dateTH(a.personal_data.birth_date)} · โทรศัพท์{" "}
                    {a.personal_data.phone}
                  </p>
                  <p>ที่อยู่ {a.personal_data.address}</p>
                  <h3 className="mt-5">การศึกษา</h3>
                  {d.education.map((e, i) => (
                    <p key={i}>
                      {e.degree} {e.major} · {e.institution} · ปี{" "}
                      {e.graduation_year || "—"} · GPA {e.gpa ?? "—"}
                    </p>
                  ))}
                  <h3 className="mt-5">ประสบการณ์</h3>
                  {d.experience.length ? (
                    d.experience.map((e, i) => (
                      <p key={i}>
                        {e.position} · {e.employer} · {dateTH(e.start_date)} –{" "}
                        {dateTH(e.end_date)}
                        <br />
                        {e.details}
                      </p>
                    ))
                  ) : (
                    <p className="muted">ไม่ได้ระบุ</p>
                  )}
                </section>
                <section className="panel">
                  <h2>เอกสารประกอบ</h2>
                  <div className="stack">
                    {d.documents
                      .filter((x) => x.document_type !== "payment")
                      .map((doc) => (
                        <div className="document-row" key={doc.id}>
                          <div>
                            <strong>
                              {j.required_documents.find(
                                (r) => r.key === doc.document_type,
                              )?.label || doc.document_type}
                            </strong>
                            <small>{doc.file_name}</small>
                          </div>
                          <PreviewButton path={doc.storage_path} />
                        </div>
                      ))}
                  </div>
                </section>
                {d.results.map((r) => (
                  <section className="panel" key={r.id}>
                    <h2>ผลการคัดเลือก</h2>
                    <p>
                      {outcomeLabels[r.outcome]}
                      {r.score !== null && ` · คะแนน ${r.score}`}
                    </p>
                    <p>{r.remark}</p>
                  </section>
                ))}
              </div>
              <aside>
                <section className="panel">
                  <h2>ความคืบหน้า</h2>
                  <ol className="timeline">
                    {[...d.history]
                      .sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime(),
                      )
                      .map((h) => (
                        <li key={h.id}>
                          <strong>
                            {statuses[h.to_status as keyof typeof statuses]}
                          </strong>
                          <small>{dateTH(h.created_at, true)}</small>
                          {h.message && <p>{h.message}</p>}
                        </li>
                      ))}
                  </ol>
                </section>
                {auth.role === "applicant" &&
                  [
                    "draft",
                    "submitted",
                    "under_review",
                    "needs_correction",
                  ].includes(a.status) && (
                    <section className="panel">
                      {withdraw ? (
                        <>
                          <p>ยืนยันถอนใบสมัครตำแหน่งนี้?</p>
                          <div className="flex gap-2">
                            <button
                              className="btn danger small"
                              disabled={busy}
                              onClick={cancel}
                            >
                              ยืนยันถอน
                            </button>
                            <button
                              className="btn outline small"
                              onClick={() => setWithdraw(false)}
                            >
                              กลับ
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          className="btn outline small"
                          onClick={() => setWithdraw(true)}
                        >
                          ถอนใบสมัคร
                        </button>
                      )}
                    </section>
                  )}
              </aside>
            </div>
            {j.fee_amount > 0 && (
              <section className="panel">
                <Title
                  title="หลักฐานการชำระเงิน"
                  description={`ค่าธรรมเนียม ${money(Number(j.fee_amount))}`}
                />
                <p className="pre-wrap">{j.payment_instructions}</p>
                <Badge status={a.payment_status} payment />
                {auth.role === "applicant" &&
                  a.payment_status !== "confirmed" &&
                  !["withdrawn", "ineligible"].includes(a.status) && (
                    <>
                      <div className="mt-4">
                        <DocumentUpload
                          id={id!}
                          requirement={{
                            key: "payment",
                            label: "สลิปการชำระเงิน",
                            required: true,
                          }}
                          document={d.documents.find(
                            (x) => x.document_type === "payment",
                          )}
                          maxMb={j.max_file_mb}
                        />
                      </div>
                      <form className="form-grid mt-4" onSubmit={pay}>
                        <Field
                          label="ยอดเงิน"
                          type="number"
                          name="amount"
                          defaultValue={j.fee_amount}
                          required
                          step="0.01"
                        />
                        <Field
                          label="วันเวลาชำระ (ค.ศ. เวลาไทย)"
                          type="datetime-local"
                          name="paid_at"
                          defaultValue={bangkokInput(new Date().toISOString())}
                          required
                        />
                        <Field
                          label="เลขอ้างอิง (ถ้ามี)"
                          name="reference"
                          maxLength={100}
                        />
                        <div className="self-end">
                          <Submit busy={busy}>
                            <CreditCard size={17} /> ส่งให้เจ้าหน้าที่ตรวจ
                          </Submit>
                        </div>
                      </form>
                    </>
                  )}
                <div className="table-wrap mt-4">
                  <table>
                    <thead>
                      <tr>
                        <th>วันเวลา</th>
                        <th>ยอด</th>
                        <th>สถานะ</th>
                        <th>เหตุผล</th>
                        <th>สลิป</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{dateTH(p.paid_at, true)}</td>
                          <td>{money(Number(p.amount))}</td>
                          <td>
                            <Badge status={p.status} payment />
                          </td>
                          <td>{p.reason}</td>
                          <td>
                            <PreviewButton path={p.slip_path} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <small className="muted">
                  ใบสมัครและหลักฐานรับชำระเป็นคนละเอกสาร
                  การอัปโหลดสลิปยังไม่ถือว่ายืนยันการชำระเงิน
                </small>
              </section>
            )}
          </>
        )}
      </State>
    </div>
  );
}
export function PrintApplication({ exam = false }: { exam?: boolean }) {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
  });
  const schedules = useQuery({
    queryKey: ["exam-schedules"],
    queryFn: () => rows("exam_schedules", "*", "exam_at"),
    enabled: exam,
  });
  const [photo, setPhoto] = useState(""),
    [selected, setSelected] = useState("");
  const d = q.data,
    a = d?.application,
    s = a?.snapshot;
  const photoPath =
    s?.documents?.find((x) => x.document_type === "photo")?.storage_path ||
    d?.documents.find((x) => x.document_type === "photo")?.storage_path;
  useEffect(() => {
    let active = true;
    setPhoto("");
    if (photoPath)
      void signedFile(photoPath).then((url) => {
        if (active) setPhoto(url);
      });
    return () => {
      active = false;
    };
  }, [photoPath]);
  const assignment =
    d?.assignments.find((x) => x.id === selected) || d?.assignments[0];
  const schedule = schedules.data?.find(
    (x) => x.id === assignment?.schedule_id && x.published,
  );
  return (
    <div className="container section print-container">
      <div className="no-print flex gap-2 mb-4">
        <Link className="btn outline" to={`/application/${id}`}>
          <ArrowLeft size={17} /> กลับ
        </Link>
        <button
          className="btn primary"
          disabled={!s || (exam && !schedule) || (!!photoPath && !photo)}
          onClick={printPage}
        >
          <Printer size={17} /> พิมพ์ / บันทึก PDF
        </button>
        {exam && (d?.assignments.length || 0) > 1 && (
          <Select
            label="กำหนดสอบ"
            value={selected || assignment?.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {d?.assignments.map((x) => (
              <option key={x.id} value={x.id}>
                {x.exam_number}
              </option>
            ))}
          </Select>
        )}
      </div>
      <State
        loading={q.isPending || (exam && schedules.isPending)}
        error={q.error || schedules.error}
      >
        {!s ? (
          <Notice>ใบสมัครต้องส่งสำเร็จก่อนดาวน์โหลดเอกสาร</Notice>
        ) : exam && !schedule ? (
          <Notice>ยังไม่มีกำหนดสอบที่เผยแพร่</Notice>
        ) : (
          <article className="print-sheet">
            <header className="print-heading">
              <h2>มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน</h2>
              <h3>วิทยาเขตขอนแก่น</h3>
              <h1>{exam ? "บัตรประจำตัวสอบ" : "ใบสมัครบุคลากรออนไลน์"}</h1>
              <p>เลขผู้สมัคร {a?.application_number}</p>
            </header>
            {photo && (
              <img
                className="applicant-photo"
                src={photo}
                alt="รูปติดใบสมัคร"
              />
            )}
            {exam && <h2>เลขประจำตัวสอบ {assignment?.exam_number}</h2>}
            <h3>ตำแหน่ง {s.job.title}</h3>
            <p>
              รอบรับสมัคร {s.round.name} · ปี พ.ศ. {s.round.year_be}
            </p>
            <h3>ข้อมูลผู้สมัคร</h3>
            <p>
              ชื่อ {s.personal.prefix}
              {s.personal.first_name} {s.personal.last_name}
            </p>
            <p>
              วันเกิด {dateTH(s.personal.birth_date)} · โทรศัพท์{" "}
              {s.personal.phone}
            </p>
            <p>อีเมล {s.email}</p>
            {!exam && (
              <>
                <p>ที่อยู่ {s.personal.address}</p>
                {s.personal.national_id && (
                  <p>เลขประจำตัวประชาชน {s.personal.national_id}</p>
                )}
                <h3>ประวัติการศึกษา</h3>
                <table>
                  <thead>
                    <tr>
                      <th>วุฒิ / สาขา</th>
                      <th>สถานศึกษา</th>
                      <th>ปี พ.ศ.</th>
                      <th>GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.education.map((e, i) => (
                      <tr key={i}>
                        <td>
                          {e.degree} / {e.major}
                        </td>
                        <td>{e.institution}</td>
                        <td>{e.graduation_year}</td>
                        <td>{e.gpa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>ประสบการณ์ทำงาน</h3>
                {s.experience.length ? (
                  s.experience.map((e, i) => (
                    <p key={i}>
                      {e.employer} · {e.position} ({dateTH(e.start_date)} –{" "}
                      {dateTH(e.end_date)})<br />
                      {e.details}
                    </p>
                  ))
                ) : (
                  <p>ไม่ได้ระบุ</p>
                )}
                <h3>เอกสารที่แนบ</h3>
                {s.documents
                  .filter((d) => d.document_type !== "payment")
                  .map((d) => (
                    <p key={d.id}>
                      ✓{" "}
                      {s.job.required_documents.find(
                        (r) => r.key === d.document_type,
                      )?.label || d.document_type}
                    </p>
                  ))}
              </>
            )}
            {exam && schedule && (
              <section className="exam-print-info">
                <h3>{schedule.title}</h3>
                <p>วันเวลา {dateTH(schedule.exam_at, true)}</p>
                <p>สถานที่ {schedule.venue}</p>
                <p className="pre-wrap">{schedule.instructions}</p>
              </section>
            )}
            <p className="print-certification">
              {exam
                ? "กรุณานำบัตรนี้และหลักฐานแสดงตนมาตามกำหนดการสอบ"
                : "ผู้สมัครรับรองความถูกต้องของข้อมูลผ่านระบบแล้ว"}
            </p>
            <footer>
              บันทึกใบสมัคร {dateTH(a?.submitted_at, true)} ·
              เอกสารจากระบบรับสมัครบุคลากรออนไลน์
              <br />
              แผนกงานบริหารงานบุคคล มทร.อีสาน วิทยาเขตขอนแก่น
            </footer>
          </article>
        )}
      </State>
    </div>
  );
}
