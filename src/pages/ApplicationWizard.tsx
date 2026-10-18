import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Save, Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { useCatalog } from "../hooks/useCatalog";
import { getApplication, saveDraft, rpc, rows } from "../services/api";
import { DocumentUpload, CopyCertificationNotice } from "../components/DocumentUpload";
import PaymentBankDetails from "../components/PaymentBankDetails";
import {
  Field,
  Select,
  Textarea,
  Notice,
  State,
  Title,
} from "../components/UI";
import { errorTH } from "../lib/errors";
import { dateTH, money, bangkokISO, bangkokInput } from "../lib/format";
import { ThaiDateField } from "../components/ThaiDateField";
import { personalSchema, validThaiID, educationIssue } from "../validation/forms";
import type { Personal, Education, Experience } from "../types/models";
const emptyEducation = (): Education => ({
  degree: "",
  major: "",
  institution: "",
  graduation_year: "",
  gpa: "",
});
const emptyExperience = (): Experience => ({
  employer: "",
  position: "",
  details: "",
  start_date: "",
  end_date: "",
});
const steps = [
  "ข้อมูลส่วนตัว",
  "การศึกษา / ประสบการณ์",
  "เลือกตำแหน่ง",
  "แนบเอกสาร",
  "ชำระเงิน / แนบสลิป",
  "ตรวจทาน / ยืนยัน",
];
export default function ApplicationWizard() {
  const { id, jobId } = useParams(),
    nav = useNavigate(),
    auth = useAuth(),
    catalog = useCatalog(),
    qc = useQueryClient();
  const [appId, setAppId] = useState<string | null>(id || null),
    [selected, setSelected] = useState(jobId || ""),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [consent, setConsent] = useState(false),
    [paidAt, setPaidAt] = useState(() => bangkokInput(new Date().toISOString())),
    [paymentRef, setPaymentRef] = useState("");
  const [personal, setPersonal] = useState<Personal>({
    prefix: auth.profile?.prefix || "นาย",
    first_name: auth.profile?.first_name || "",
    last_name: auth.profile?.last_name || "",
    birth_date: "",
    phone: auth.profile?.phone || "",
    address: "",
    national_id: "",
  });
  const [education, setEducation] = useState<Education[]>([emptyEducation()]),
    [experience, setExperience] = useState<Experience[]>([]);
  const hydrated = useRef("");
  const q = useQuery({
    queryKey: ["application", appId],
    queryFn: () => getApplication(appId!),
    enabled: !!appId,
  });
  // Resume a saved form when the applicant returns to its job.
  // Unsubmitted records are hidden from the applicant's submitted list.
  const existing = useQuery({
    queryKey: ["existing-application-for-job", auth.session?.user.id, jobId],
    enabled: !!jobId && !id && !!auth.session?.user.id,
    queryFn: async () => {
      const r = await supabase
        .from("applications")
        .select("id,status")
        .eq("user_id", auth.session!.user.id)
        .eq("job_id", jobId!)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  useEffect(() => {
    if (id) setAppId(id);
  }, [id]);
  useEffect(() => {
    if (!id && existing.data) {
      const editable = ["draft", "needs_correction"].includes(existing.data.status);
      if (editable) setAppId(existing.data.id);
      nav(
        editable
          ? `/application/${existing.data.id}/edit`
          : `/application/${existing.data.id}`,
        { replace: true },
      );
    }
  }, [id, existing.data, nav]);
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const policy = settings.data?.find((s) => s.key === "privacy")?.value;
  useEffect(() => {
    if (q.data && hydrated.current !== q.data.application.id) {
      setPersonal(q.data.application.personal_data);
      setSelected(q.data.application.job_id);
      setEducation(
        q.data.education.length ? q.data.education : [emptyEducation()],
      );
      setExperience(q.data.experience);
      hydrated.current = q.data.application.id;
    }
  }, [q.data]);
  const job =
    catalog.jobs.data?.find((j) => j.id === selected) ||
    q.data?.application.job_positions;
  const locked =
    q.data &&
    !["draft", "needs_correction"].includes(q.data.application.status);

  // A successfully submitted application is intentionally read-only.
  // Never leave applicants on the old /edit page with a confusing lock notice.
  useEffect(() => {
    if (id && q.data?.application.id === id && locked) {
      nav(`/application/${id}`, { replace: true });
    }
  }, [id, locked, nav, q.data?.application.id]);

  const documents = q.data?.documents || [];
  const paymentRequired = Number(job?.fee_amount || 0) > 0;
  const paymentDoc = documents.find((d) => d.document_type === "payment");
  const paymentRecords = q.data?.payments || [];
  const slipSubmitted = !!paymentDoc && paymentRecords.some((p: {slip_path?:string;status?:string}) => p.slip_path === paymentDoc.storage_path && p.status !== "rejected");
  const lastStep = steps.length - 1;
  const save = async () => {
    if (!selected) throw new Error("กรุณาเลือกตำแหน่ง");
    const educationError = educationIssue(education, true);
    if (educationError) throw new Error(educationError);
    const newId = await saveDraft(
      appId,
      selected,
      personal,
      education,
      experience,
    );
    setAppId(newId);
    hydrated.current = newId;
    setSaved(new Date().toISOString());
    await qc.invalidateQueries({ queryKey: ["application", newId] });
    await qc.invalidateQueries({ queryKey: ["my-applications"] });
    if (!id) nav(`/application/${newId}/edit`, { replace: true });
    return newId;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg.startsWith("กรุณา") ? msg : errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  const next = () =>
    run(async () => {
      if (
        step === 0 &&
        (!personalSchema.safeParse(personal).success ||
          (job?.require_national_id &&
            !validThaiID(personal.national_id || "")))
      )
        throw new Error("กรุณากรอกข้อมูลส่วนตัวให้ครบและถูกต้อง");
      if (step === 1) {
        const issue = educationIssue(education);
        if (issue) throw new Error(issue);
      }
      if (step === 2) await save();
      if (step === 3 && job) {
        const missing = job.required_documents.filter((r) =>
          r.required && !documents.some((d) => d.document_type === r.key));
        if (missing.length)
          throw new Error("กรุณาแนบเอกสารให้ครบ: " + missing.map((r) => r.label).join(", "));
      }
      if (step === 4 && paymentRequired && !slipSubmitted)
        throw new Error("กรุณาแนบสลิปและกดส่งหลักฐานชำระเงินก่อนดำเนินการต่อ");
      setStep((s) => s + (s === 3 && !paymentRequired ? 2 : 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  const submit = () =>
    run(async () => {
      if (!personalSchema.safeParse(personal).success ||
          (job?.require_national_id && !validThaiID(personal.national_id || "")))
        throw new Error("กรุณากรอกข้อมูลส่วนตัวให้ครบและถูกต้อง");
      const educationError = educationIssue(education);
      if (educationError) throw new Error(educationError);
      if (job?.required_documents.some((r) =>
        r.required && !documents.some((d) => d.document_type === r.key)))
        throw new Error("กรุณาแนบเอกสารบังคับให้ครบ");
      if (paymentRequired && !slipSubmitted)
        throw new Error("กรุณาแนบสลิปและกดส่งหลักฐานชำระเงินก่อนยืนยันใบสมัคร");
      if (!consent || !policy?.version)
        throw new Error("กรุณารับทราบนโยบายและรับรองข้อมูล");
      const savedId = await save();
      await rpc("submit_application", {
        p_id: savedId,
        p_consent: policy.version,
      });
      await qc.invalidateQueries({ queryKey: ["my-applications"] });
      nav(`/application/${savedId}`, { replace: true });
    });
  const submitSlip = () => run(async () => {
    if (!appId || !job || !paymentDoc) throw new Error("กรุณาแนบสลิปชำระเงินก่อน");
    await rpc("save_payment", { p_app: appId, p_amount: Number(job.fee_amount), p_paid: bangkokISO(paidAt), p_reference: paymentRef });
    await qc.invalidateQueries({ queryKey: ["application", appId] });
    setSaved(new Date().toISOString());
  });
  const update = (k: keyof Personal, v: string) =>
    setPersonal((p) => ({ ...p, [k]: v }));
  return (
    <div className="container section">
      <Title
        eyebrow="ONLINE APPLICATION"
        title={id ? "จัดการแบบฟอร์มใบสมัคร" : "สมัครตำแหน่งงาน"}
        description={job?.title}
      />
      <State
        loading={catalog.jobs.isPending || (!!appId && q.isPending) || (!id && !!jobId && (existing.isPending || !!existing.data))}
        error={catalog.jobs.error || q.error || existing.error}
      >
        {locked ? (
          <Notice kind="success">
            ระบบได้รับใบสมัครที่ยืนยันส่งแล้วเรียบร้อย กำลังเปิดหน้าติดตามสถานะ{" "}
            <Link to={`/application/${appId}`}>ดูรายละเอียดใบสมัคร</Link>
          </Notice>
        ) : (
          <>
            <div className="wizard-steps">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={step === i ? "active" : step > i ? "done" : ""}
                >
                  <span>{step > i ? <Check size={15} /> : i + 1}</span>
                  <small>{s}</small>
                </div>
              ))}
            </div>
            {error && <Notice kind="error">{error}</Notice>}
            {q.data?.application.public_message && (
              <Notice>
                รายการที่ต้องแก้ไข: {q.data.application.public_message} · ภายใน{" "}
                {dateTH(q.data.application.correction_deadline, true)}
              </Notice>
            )}
            <section className="panel wizard-body">
              <h2>{steps[step]}</h2>
              {step === 0 && (
                <div className="form-grid">
                  <Select
                    label="คำนำหน้า"
                    value={personal.prefix}
                    onChange={(e) => update("prefix", e.target.value)}
                  >
                    {["นาย", "นาง", "นางสาว", "อื่น ๆ"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                  <ThaiDateField label="วันเกิด (พ.ศ.)" value={personal.birth_date || ""} onChange={next=>update("birth_date",next)}
                    required
                  />
                  <Field
                    label="ชื่อ"
                    value={personal.first_name}
                    onChange={(e) => update("first_name", e.target.value)}
                    required
                    maxLength={100}
                  />
                  <Field
                    label="นามสกุล"
                    value={personal.last_name}
                    onChange={(e) => update("last_name", e.target.value)}
                    required
                    maxLength={100}
                  />
                  <Field
                    label="โทรศัพท์"
                    value={personal.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    required
                  />
                  <Field
                    label="อีเมลบัญชี"
                    value={auth.session?.user.email || ""}
                    readOnly
                  />
                  <div className="col-span-full">
                    <Textarea
                      label="ที่อยู่ปัจจุบัน"
                      value={personal.address}
                      onChange={(e) => update("address", e.target.value)}
                      required
                      maxLength={2000}
                    />
                  </div>
                  {job?.require_national_id && (
                    <Field
                      label="เลขประจำตัวประชาชน"
                      value={personal.national_id || ""}
                      onChange={(e) => update("national_id", e.target.value)}
                      required
                      maxLength={13}
                      inputMode="numeric"
                    />
                  )}
                </div>
              )}
              {step === 1 && (
                <>
                  <div className="stack">
                    {education.map((ed, i) => (
                      <div className="subpanel" key={i}>
                        <div className="flex justify-between">
                          <h3>การศึกษา {i + 1}</h3>
                          {education.length > 1 && (
                            <button
                              className="icon-btn"
                              aria-label="ลบการศึกษา"
                              onClick={() =>
                                setEducation(
                                  education.filter((_, x) => x !== i),
                                )
                              }
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                        <div className="form-grid">
                          {[
                            ["degree", "วุฒิการศึกษา"],
                            ["major", "สาขาวิชา"],
                            ["institution", "สถานศึกษา"],
                            ["graduation_year", "ปีสำเร็จ (พ.ศ.)"],
                            ["gpa", "เกรดเฉลี่ย"],
                          ].map(([k, l]) => (
                            <Field
                              key={k}
                              label={l}
                              value={ed[k as keyof Education]}
                              type={
                                k === "gpa" || k === "graduation_year"
                                  ? "number"
                                  : "text"
                              }
                              min={
                                k === "gpa"
                                  ? 0
                                  : k === "graduation_year"
                                    ? 2400
                                    : undefined
                              }
                              max={
                                k === "gpa"
                                  ? 4
                                  : k === "graduation_year"
                                    ? 2800
                                    : undefined
                              }
                              step={k === "gpa" ? 0.01 : undefined}
                              onChange={(e) =>
                                setEducation(
                                  education.map((v, x) =>
                                    x === i ? { ...v, [k]: e.target.value } : v,
                                  ),
                                )
                              }
                              required={[
                                "degree",
                                "major",
                                "institution",
                              ].includes(k)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn small outline mt-3"
                    onClick={() =>
                      setEducation([...education, emptyEducation()])
                    }
                  >
                    <Plus size={16} /> เพิ่มการศึกษา
                  </button>
                  <h3 className="section-heading">ประสบการณ์ทำงาน (ถ้ามี)</h3>
                  {experience.map((ex, i) => (
                    <div className="subpanel" key={i}>
                      <button
                        className="icon-btn float-right"
                        aria-label="ลบประสบการณ์"
                        onClick={() =>
                          setExperience(experience.filter((_, x) => x !== i))
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="form-grid">
                        {[
                          ["employer", "หน่วยงาน / บริษัท"],
                          ["position", "ตำแหน่ง"],
                          ["start_date", "เริ่มงาน (พ.ศ.)"],
                          ["end_date", "สิ้นสุด (พ.ศ.)"],
                        ].map(([k, l]) => k.endsWith("date") ? (
                          <ThaiDateField key={k} label={l} value={ex[k as keyof Experience]} onChange={next=>setExperience(experience.map((v,x)=>x===i?{...v,[k]:next}:v))}/>
                        ) : (
                          <Field key={k} label={l} value={ex[k as keyof Experience]} onChange={e=>setExperience(experience.map((v,x)=>x===i?{...v,[k]:e.target.value}:v))}/>
                        ))}
                        <div className="col-span-full">
                          <Textarea
                            label="รายละเอียดงาน"
                            value={ex.details}
                            onChange={(e) =>
                              setExperience(
                                experience.map((v, x) =>
                                  x === i
                                    ? { ...v, details: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn small outline"
                    onClick={() =>
                      setExperience([...experience, emptyExperience()])
                    }
                  >
                    <Plus size={16} /> เพิ่มประสบการณ์
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <Select
                    label="ตำแหน่งที่สมัคร"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={!!appId}
                  >
                    <option value="">เลือกตำแหน่ง</option>
                    {catalog.jobs.data?.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} — {j.departments?.name}
                      </option>
                    ))}
                  </Select>
                  {job && (
                    <div className="subpanel mt-4">
                      <h3>{job.title}</h3>
                      <p>{job.departments?.name}</p>
                      <p>รอบ: {job.recruitment_rounds?.name}</p>
                      <p>
                        สมัครได้สูงสุด {job.recruitment_rounds?.max_per_user}{" "}
                        ตำแหน่งต่อรอบ
                      </p>
                    </div>
                  )}
                </>
              )}
              {step === 3 && appId && job && (
                <div className="stack">
                  <CopyCertificationNotice />
                  {job.required_documents.some((r) =>
                    r.required && !documents.some((d) => d.document_type === r.key)) && (
                    <Notice kind="error">
                      ยังขาดเอกสารบังคับ: {job.required_documents
                        .filter((r) => r.required && !documents.some((d) => d.document_type === r.key))
                        .map((r) => r.label).join(", ")}
                    </Notice>
                  )}
                  {job.required_documents.map((r) => (
                    <DocumentUpload
                      key={r.key}
                      id={appId}
                      requirement={r}
                      document={documents.find(
                        (d) => d.document_type === r.key,
                      )}
                      maxMb={job.max_file_mb}
                    />
                  ))}
                </div>
              )}
              {step === 4 && paymentRequired && appId && job && (
                <div className="stack">
                  <Notice>ต้องแนบสลิปและบันทึกหลักฐานชำระเงินให้เรียบร้อยก่อนกดถัดไป เจ้าหน้าที่จะตรวจสอบภายหลัง</Notice>
                  <div className="subpanel"><strong>ค่าธรรมเนียม {money(Number(job.fee_amount))}</strong><p className="pre-wrap">{job.payment_instructions}</p></div>
                  <PaymentBankDetails />
                  <DocumentUpload id={appId} requirement={{key:"payment",label:"สลิปชำระเงิน",required:true}} document={paymentDoc} maxMb={job.max_file_mb}/>
                  <Field label="ยอดชำระ (บาท)" value={String(job.fee_amount)} readOnly />
                  <ThaiDateField label="วันเวลาชำระ (พ.ศ. เวลาไทย)" withTime value={paidAt} onChange={setPaidAt} required />
                  <Field label="เลขอ้างอิง (ถ้ามี)" value={paymentRef} maxLength={100} onChange={e=>setPaymentRef(e.target.value)}/>
                  <button type="button" className="btn primary" disabled={busy || !paymentDoc} onClick={submitSlip}>ส่งหลักฐานชำระเงินให้เจ้าหน้าที่ตรวจ</button>
                  {slipSubmitted && <Notice kind="success">ส่งสลิปเรียบร้อยแล้ว สามารถกดถัดไปเพื่อตรวจทานใบสมัครได้</Notice>}
                </div>
              )}
              {step === lastStep && (
                <>
                  {(() => {
                    const missing = job?.required_documents.filter((r) =>
                      r.required && !documents.some((d) => d.document_type === r.key)) || [];
                    const issues = [
                      ...(!personalSchema.safeParse(personal).success ||
                        (job?.require_national_id && !validThaiID(personal.national_id || ""))
                        ? ["ข้อมูลส่วนตัวยังไม่ครบหรือไม่ถูกต้อง"] : []),
                      ...(educationIssue(education) ? [educationIssue(education)!] : []),
                      ...(missing.length ? ["เอกสารที่ขาด: " + missing.map((r) => r.label).join(", ")] : []),
                      ...(paymentRequired && !slipSubmitted ? ["ยังไม่ได้ส่งหลักฐานชำระเงิน"] : []),
                    ];
                    return issues.length ? (
                      <Notice kind="error">
                        กรุณาแก้ไขก่อนส่งใบสมัคร: {issues.join(" • ")}
                      </Notice>
                    ) : (
                      <Notice kind="success">ตรวจข้อมูลสำคัญครบแล้ว กรุณาตรวจทานอีกครั้งก่อนส่ง</Notice>
                    );
                  })()}
                  <div className="review-summary">
                    <h3>
                      {personal.prefix}
                      {personal.first_name} {personal.last_name}
                    </h3>
                    <p>
                      {job?.title} · {job?.departments?.name}
                    </p>
                    <p>
                      โทรศัพท์ {personal.phone} · อีเมล{" "}
                      {auth.session?.user.email}
                    </p>
                    <p>ที่อยู่: {personal.address}</p>
                    <p>
                      การศึกษา:{" "}
                      {education
                        .map((e) => `${e.degree} ${e.major} (${e.institution})`)
                        .join(" / ")}
                    </p>
                    <p>
                      แนบเอกสารแล้ว{" "}
                      {
                        documents.filter((d) => d.document_type !== "payment")
                          .length
                      }{" "}
                      รายการ
                    </p>
                  </div>
                  <details>
                    <summary>นโยบายข้อมูลส่วนบุคคล ({policy?.version})</summary>
                    <p className="pre-wrap">{policy?.text}</p>
                  </details>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    ฉันรับรองว่าข้อมูลและเอกสารเป็นความจริง
                    และรับทราบนโยบายข้อมูลส่วนบุคคลฉบับนี้
                  </label>
                  <Notice>
                    เมื่อส่งแล้ว ข้อมูลจะถูกล็อกจนกว่าเจ้าหน้าที่เปิดให้แก้ไข
                    หลังส่งใบสมัครแล้ว โปรดรอ Admin ตรวจสอบและกำหนดเลขผู้สมัคร
                  </Notice>
                </>
              )}
              <div className="wizard-actions">
                {step > 0 ? (
                  <button
                    className="btn outline"
                    disabled={busy}
                    onClick={() => setStep((s) => s === lastStep && !paymentRequired ? s - 2 : s - 1)}
                  >
                    <ArrowLeft size={17} /> ย้อนกลับ
                  </button>
                ) : (
                  <Link className="btn outline" to="/dashboard">
                    กลับ
                  </Link>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="btn outline"
                    disabled={busy || !selected}
                    onClick={() =>
                      run(async () => {
                        await save();
                      })
                    }
                  >
                    <Save size={17} /> บันทึกร่าง
                  </button>
                  {step < lastStep ? (
                    <button
                      className="btn primary"
                      disabled={busy || (step === 4 && paymentRequired && !slipSubmitted)}
                      onClick={next}
                    >
                      ถัดไป <ArrowRight size={17} />
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={busy || !consent}
                      onClick={submit}
                    >
                      {busy ? "กำลังส่ง…" : "ยืนยันส่งใบสมัคร"}
                    </button>
                  )}
                </div>
              </div>
              {saved && (
                <small className="muted">
                  บันทึกล่าสุด {dateTH(saved, true)}
                </small>
              )}
            </section>
          </>
        )}
      </State>
    </div>
  );
}
