import { useState, type FormEvent } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApplication, rpc } from "../../services/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { dateTH, bangkokISO, money } from "../../lib/format";
import { errorTH } from "../../lib/errors";
import { ThaiDateField } from "../../components/ThaiDateField";
import { PreviewButton } from "../../components/DocumentUpload";
import ApplicantDocumentsDownload from "../../components/ApplicantDocumentsDownload";
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
import { AdminApplicantDetails } from "../../components/AdminApplicantDetails";
import ExamCardApprovalStep from "../../components/staff/ExamCardApprovalStep";
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
  const receipt = useQuery({
    queryKey: ["payment-receipt", id],
    enabled: !!id,
    queryFn: async () => {
      const {data,error} = await supabase.from("payment_receipts")
        .select("receipt_number").eq("application_id", id!).maybeSingle();
      if(error) throw error;
      return data;
    },
  });
  const issueLegacyReceipt = async (paymentId: string) => {
    setBusy(true);setError("");
    try {
      const number = await rpc<string>("admin_issue_payment_receipt", {p_payment:paymentId});
      await qc.invalidateQueries({queryKey:["payment-receipt",id]});
      setSuccess("ออกใบรับชำระเงินเลขที่ " + number + " แล้ว ผู้สมัครดาวน์โหลด PDF ได้");
    } catch(e) { setError(errorTH(e)); }
    finally { setBusy(false); }
  };
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
    [assignedNumber, setAssignedNumber] = useState(""),
    [reviewStep, setReviewStep] = useState(0),
    [stepBusy, setStepBusy] = useState(false),
    [stepError, setStepError] = useState("");
  const reviewMarks = useQuery({
    queryKey: ["application-review-steps", id],
    enabled: !!id,
    queryFn: async () => {
      const {data,error} = await supabase.from("application_review_steps")
        .select("step,checked_at").eq("application_id",id!);
      if(error) throw error;
      return data as {step:string;checked_at:string}[];
    },
  });
  const setReviewMark = async (step: "personal" | "documents", done: boolean) => {
    setStepBusy(true);setStepError("");
    try {
      await rpc("staff_mark_review_step",{p_id:id,p_step:step,p_done:done});
      await qc.invalidateQueries({queryKey:["application-review-steps",id]});
      if(done) setReviewStep(step === "personal" ? 1 : 2);
    } catch(e){setStepError(errorTH(e));}
    finally{setStepBusy(false);}
  };
  const d = q.data,
    a = d?.application;
  const marked = (step: string) => !!reviewMarks.data?.some(x=>x.step===step);
  const feeNeeded = Number(a?.job_positions?.fee_amount || 0)>0;
  const signatureRequirements = [
    ...(!marked("personal") ? ["กดยืนยันตรวจข้อมูลผู้สมัครในแท็บข้อมูลผู้สมัคร"] : []),
    ...(!marked("documents") ? ["กดยืนยันตรวจเอกสารในแท็บเอกสารแนบ"] : []),
    ...(a?.status !== "eligible" ? ["บันทึกผลคุณสมบัติเป็น ผ่านคุณสมบัติ"] : []),
    ...(!a?.application_number ? ["กำหนดเลขผู้สมัครและกดบันทึก"] : []),
    ...(!["confirmed","not_required"].includes(a?.payment_status || "") ? ["ตรวจและยืนยันการชำระค่าธรรมเนียม (ถ้ามี)"] : []),
  ];
  const finalPrintApproved = Boolean(
    a && canPrint.data && signature.data && printApproval.data &&
    signature.data.application_number_at_signing === a.application_number &&
    printApproval.data.application_number_at_approval === a.application_number &&
    signature.data.signed_snapshot_md5 === printApproval.data.approved_snapshot_md5 &&
    new Date(printApproval.data.approved_at).getTime() >= new Date(signature.data.signed_at).getTime()
  );
  const steps = [
    {name:"ข้อมูลผู้สมัคร",hint:"ตรวจชื่อและประวัติ",tone:"blue",done:marked("personal")},
    {name:"เอกสารแนบ",hint:"เปิดตรวจทีละไฟล์",tone:"purple",done:marked("documents")},
    {name:"ชำระเงิน",hint:"ตรวจสลิปและใบรับชำระ",tone:"amber",done:!feeNeeded || a?.payment_status==="confirmed"},
    {name:"ผลคุณสมบัติ",hint:"พิจารณาผล",tone:"green",done:["eligible","ineligible"].includes(a?.status || "")},
    {name:"เลขที่และ PDF",hint:"ออกเลข → ลงนาม → อนุมัติ",tone:"teal",done:finalPrintApproved},
    {name:"บันทึกเจ้าหน้าที่",hint:"บันทึกภายใน",tone:"slate",done:false},
  ];
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
      if (actualNext === "eligible" || actualNext === "ineligible") setReviewStep(4);
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
      setSuccess("บันทึกเลขผู้สมัครแล้ว โปรดลงลายเซ็นรับรองก่อนอนุมัติดาวน์โหลด PDF");
    } catch (e) { setError(errorTH(e)); }
    finally { setBusy(false); }
  };
  const approvePrint = async () => {
    if(auth.role!=="admin" || !a?.application_number || !signature.data) return;
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
          <div className="flex gap-2 flex-wrap">
            {auth.role === "admin" && id && <ApplicantDocumentsDownload applicationId={id} />}
            <Link className="btn outline" to={`/application/${id}`}>เปิดข้อมูลและใบสมัคร A4</Link>
          </div>
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
                   {a.position_order != null && <p className="muted">ลำดับสมัครตามเวลาส่งใบสมัครของตำแหน่งนี้ <strong>({a.position_order})</strong> · {dateTH(a.submitted_at, true)}</p>}
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
              <div className="review-step-tabs" role="tablist" aria-label="ขั้นตอนการตรวจใบสมัคร">
                {steps.map((item,i) => <button key={item.name} type="button" role="tab" aria-selected={reviewStep===i}
                  className={`review-step-tab tone-${item.tone} ${reviewStep===i?"current":""}`}
                  onClick={()=>{setReviewStep(i);setStepError("");}}>
                  <span className="review-step-number">{item.done?<CheckCircle2 size={18}/>:i+1}</span>
                  <span><strong>{item.name}</strong><small>{item.done?"เสร็จแล้ว":item.hint}</small></span>
                </button>)}
              </div>
              {stepError&&<Notice kind="error">{stepError}</Notice>}
              <div className="review-step-navigation">
                <button type="button" className="btn outline" disabled={reviewStep===0} onClick={()=>setReviewStep(v=>Math.max(0,v-1))}>
                  <ChevronLeft size={17}/> ก่อนหน้า
                </button>
                <span>ขั้นตอน {reviewStep+1} จาก {steps.length}</span>
                <button type="button" className="btn primary" disabled={reviewStep===steps.length-1} onClick={()=>setReviewStep(v=>Math.min(steps.length-1,v+1))}>
                  ขั้นตอนถัดไป <ChevronRight size={17}/>
                </button>
              </div>
            </section>
            <div className="apple-review-columns">
            <section className="panel review-color-panel tone-blue" id="review-personal" hidden={reviewStep!==0}>
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
              <AdminApplicantDetails
                person={a.snapshot?.personal || a.personal_data}
                email={a.snapshot?.email}
              />
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
              {auth.can("review") && <button type="button" className="btn primary mt-4" disabled={stepBusy||marked("personal")} onClick={()=>void setReviewMark("personal",true)}>
                <CheckCircle2 size={17}/> {marked("personal")?"ตรวจข้อมูลแล้ว":"ยืนยันตรวจข้อมูลผู้สมัครแล้ว"}
              </button>}
            </section>
            {auth.role === "admin" && a.submitted_at && (
              <form className="panel stack review-color-panel tone-teal" hidden={reviewStep!==4} onSubmit={assignNumber}>
                <h2>ออกเลขผู้สมัครโดย Admin</h2>
                {a.position_order != null && <p>ลำดับการสมัครของตำแหน่งนี้ <strong>({a.position_order})</strong> (แยกจากเลขผู้สมัครทางราชการ)</p>}
                <Notice>กำหนดเลขได้เองทั้งภาษาไทย ภาษาอังกฤษ ตัวเลขและเครื่องหมาย เช่น รับสมัคร/๒๕๖๙/๑ หรือ HR-2569-A1 โดยห้ามซ้ำกับใบสมัครอื่น</Notice>
                <Field label="เลขผู้สมัคร (กรอกเอง)" value={assignedNumber}
                  onChange={e => setAssignedNumber(e.target.value)}
                  placeholder={a.application_number || "มทร.ขก./๒๕๖๙/๐๐๑"}
                  required maxLength={80} />
                <Submit busy={busy}>{a.application_number ? "เปลี่ยนเลขผู้สมัคร" : "ยืนยันออกเลขผู้สมัคร"}</Submit>
              </form>
            )}
            <section className="panel review-color-panel tone-purple" hidden={reviewStep!==1} id="review-documents">
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
              {auth.can("review") && <button type="button" className="btn primary mt-4" disabled={stepBusy||marked("documents")} onClick={()=>void setReviewMark("documents",true)}>
                <CheckCircle2 size={17}/> {marked("documents")?"ตรวจเอกสารแล้ว":"ยืนยันตรวจเอกสารครบแล้ว"}
              </button>}
            </section>
            {auth.can("review") &&
              ["submitted", "under_review"].includes(a.status) && (
                <form className="panel stack review-color-panel tone-green" hidden={reviewStep!==3} id="review-decision" onSubmit={submit}>
                  <h2>ผลตรวจคุณสมบัติ</h2>
                  <Notice>เมื่อยืนยันผลผ่านคุณสมบัติแล้ว ระบบจะพาไปขั้นตอน 5 เพื่อออกเลขผู้สมัคร จากนั้นจึงลงลายเซ็นและอนุมัติ PDF ได้</Notice>
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
              [...d.payments]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .filter((p, index) =>
                  p.status === "confirmed" ||
                  (a.payment_status !== "confirmed" && index === 0))
                .map((p) => (
                <section className="panel review-color-panel tone-amber" hidden={reviewStep!==2} key={p.id}>
                  <h2>ตรวจหลักฐานชำระเงิน</h2>
                  <p>
                    {money(Number(p.amount))} · {dateTH(p.paid_at, true)} ·
                    อ้างอิง {p.reference || "ไม่ระบุ"}
                  </p>
                  <Badge status={p.status} payment />
                  {p.status === "confirmed" && receipt.data && <p className="mt-3">
                    <Link className="btn outline" to={`/application/${id}/receipt`}>ดูใบรับชำระเงิน {receipt.data.receipt_number}</Link>
                  </p>}
                  {p.status === "confirmed" && !receipt.isPending && !receipt.data && auth.can("payments") && (
                    <button className="btn outline mt-3" disabled={busy} type="button"
                      onClick={() => void issueLegacyReceipt(p.id)}>ออกใบรับชำระเงินสำหรับรายการที่ยืนยันก่อนปรับระบบ</button>
                  )}
                  <div className="mt-3">
                    <PreviewButton path={p.slip_path} />
                  </div>
                  {p.status === "pending" && a.payment_status !== "confirmed" && (
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
            {auth.role === "admin" && reviewStep===4 && (
              <>
                <div className="notice">
                  <CheckCircle2 size={18}/>
                  ขั้นตอนออก PDF ใบสมัคร (ไม่ใช่บัตรเข้าห้องสอบ): 1. บันทึกเลขใบสมัคร → 2. เซ็นรับรอง → 3. อนุมัติดาวน์โหลด PDF ใบสมัคร
                </div>
                {a.status !== "eligible" && a.status !== "ineligible" && <button type="button" className="btn outline mb-4" onClick={() => setReviewStep(3)}>ไปที่แท็บผลคุณสมบัติ เพื่อบันทึกผลการพิจารณา</button>}
                <AdminSignaturePad applicationId={id!} existing={signature.data || null}
                  eligible={signatureRequirements.length === 0} missingSteps={signatureRequirements} refresh={refresh} />
                {auth.role === "admin" && a.submitted_at && (
              <section className="panel stack review-color-panel tone-teal" hidden={reviewStep!==4} id="review-print-approval">
                <h2>ขั้นตอนสุดท้ายของใบสมัคร: อนุมัติดาวน์โหลด PDF ใบสมัคร</h2>
                <p className="muted">ปุ่มนี้อนุมัติเฉพาะ PDF ใบสมัครที่มีลายเซ็นเท่านั้น ไม่ได้ออกบัตรประจำตัวผู้สมัครสอบ</p>
                {finalPrintApproved ? (
                  <Notice kind="success">ใบสมัคร: ลงลายเซ็นและอนุมัติให้ดาวน์โหลด PDF เรียบร้อยแล้ว (ยังไม่ใช่บัตรสอบ)</Notice>
                ) : signature.data ? (
                  <Notice kind="success">เซ็นรับรองเรียบร้อยแล้ว พร้อมให้ Admin ตรวจทานและอนุมัติดาวน์โหลดเป็นขั้นตอนสุดท้าย</Notice>
                ) : (
                  <Notice>ยังไม่สามารถอนุมัติดาวน์โหลดได้ กรุณาลงลายเซ็นรับรองใบสมัครในกรอบด้านบนก่อน</Notice>
                )}
                <button type="button" className="btn primary" disabled={busy || !a.application_number || !signature.data || signatureRequirements.length > 0 || finalPrintApproved}
                  onClick={() => void approvePrint()}>
                  {finalPrintApproved ? "อนุมัติ PDF ใบสมัครแล้ว" : "อนุมัติให้ดาวน์โหลด PDF ใบสมัคร"}
                </button>
              </section>
            )}
            {a.status === "eligible" && finalPrintApproved && id && (
              <ExamCardApprovalStep applicationId={id} enabled={reviewStep === 4} />
            )}

              </>
            )}
            {auth.can("review") && (
              <section className="panel review-color-panel tone-slate" hidden={reviewStep!==5} id="review-notes">
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
