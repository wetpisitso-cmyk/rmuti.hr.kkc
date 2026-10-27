import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BriefcaseBusiness,
  ArrowRight,
  Plus,
  UserRound,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { dateTH } from "../lib/format";
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
import type { Application } from "../types/models";
export default function Dashboard() {
  const a = useAuth(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-applications", a.session?.user.id],
    queryFn: async () => {
      const r = await supabase
        .from("applications")
        .select("*,job_positions(*,departments(*),recruitment_rounds(*))")
        .eq("user_id", a.session!.user.id)
        .not("submitted_at", "is", null)
        .neq("status", "draft")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data as Application[];
    },
  });
  const examCards = useQuery({
    queryKey: ["my-exam-card-assignments", a.session?.user.id, q.data?.map(x=>x.id)],
    enabled: !!a.session && !!q.data?.some(x=>x.status === "eligible"),
    queryFn: async () => {
      const ids = (q.data || []).filter(x=>x.status === "eligible").map(x=>x.id);
      if (!ids.length) return [] as {id:string;application_id:string}[];
      const r = await supabase.from("exam_assignments")
        .select("id,application_id").in("application_id",ids);
      if(r.error)throw r.error;
      return r.data as {id:string;application_id:string}[];
    },
  });
  const notifications = useQuery({
    queryKey: ["notifications", a.session?.user.id],
    queryFn: async () => {
      const r = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", a.session!.user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const [noticeError, setNoticeError] = useState("");
  const markRead = async (id: string) => {
    const r = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (r.error) setNoticeError(errorTH(r.error));
    else await qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <div className="container section">
      <Title
        eyebrow="APPLICANT DASHBOARD"
        title={`สวัสดี ${a.profile?.first_name || "ผู้สมัคร"}`}
        description="จัดการใบสมัครและติดตามความคืบหน้าของคุณ"
        action={
          <div className="flex gap-2 flex-wrap">
            <Link className="btn outline" to="/profile">
              <UserRound size={18} />
              โปรไฟล์
            </Link>
            <Link className="btn primary" to="/">
              <Plus size={18} /> ค้นหาตำแหน่ง
            </Link>
          </div>
        }
      />
      <div className="kpi-grid three">
        <div className="kpi">
          <span>ใบสมัครที่ส่งแล้ว</span>
          <strong>{q.data?.length || 0}</strong>
          <BriefcaseBusiness />
        </div>
        <div className="kpi">
          <span>อยู่ระหว่างดำเนินการ</span>
          <strong>
            {q.data?.filter((x) =>
              ["submitted", "under_review"].includes(x.status),
            ).length || 0}
          </strong>
          <ArrowRight />
        </div>
        <div className="kpi orange">
          <span>ต้องแก้ไขเอกสาร</span>
          <strong>
            {q.data?.filter((x) => x.status === "needs_correction").length || 0}
          </strong>
          <Bell />
        </div>
      </div>
      <h2 className="section-heading">ใบสมัครที่ยืนยันส่งแล้ว</h2>
      <State loading={q.isPending} error={q.error} empty={!q.data?.length}>
        <div className="stack">
          {q.data?.map((x) => (
            <article className="application-card" key={x.id}>
              <div className="application-icon">
                <BriefcaseBusiness size={25} />
              </div>
              <div className="flex-1">
                <div className="flex gap-2 flex-wrap">
                  <Badge status={x.status} />
                  <Badge status={x.payment_status} payment />
                </div>
                <h3>{x.job_positions?.title || x.snapshot?.job.title}</h3>
                <p>
                  {x.application_number || (x.submitted_at ? "รอเจ้าหน้าที่ออกเลขผู้สมัคร" : "ยังไม่ได้ส่งใบสมัคร")} · บันทึกล่าสุด{" "}
                  {dateTH(x.updated_at, true)}
                </p>
                {x.public_message && (
                  <p className="public-message">{x.public_message}</p>
                )}
                {x.correction_deadline && (
                  <small className="error-text">
                    แก้ไขภายใน {dateTH(x.correction_deadline, true)}
                  </small>
                )}
              </div>
              {x.status === "eligible" && examCards.data?.filter(card => card.application_id === x.id).map(card => (
                <Link key={card.id} className="btn outline" to={"/application/"+x.id+"/exam-card/"+card.id}>
                  ตรวจสอบ / ดาวน์โหลดบัตรประจำตัวผู้สมัครสอบ
                </Link>
              ))}
              <Link className="btn outline" to={`/application/${x.id}`}>
                ดูใบสมัคร <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      </State>
      <h2 className="section-heading">การแจ้งเตือน</h2>
      {noticeError && <Notice kind="error">{noticeError}</Notice>}
      <State
        loading={notifications.isPending}
        error={notifications.error}
        empty={!notifications.data?.length}
      >
        <div className="stack">
          {notifications.data?.map((n) => (
            <div
              key={n.id}
              className={`notification ${n.read_at ? "read" : ""}`}
            >
              <Bell size={20} />
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{dateTH(n.created_at, true)}</small>
              </div>
              {!n.read_at && (
                <button
                  className="btn small outline"
                  onClick={() => markRead(n.id)}
                >
                  อ่านแล้ว
                </button>
              )}
            </div>
          ))}
        </div>
      </State>
    </div>
  );
}
export function ProfilePage() {
  const a = useAuth(),
    qc = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ...d, updated_at: new Date().toISOString() })
        .eq("id", a.session!.user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["identity"] });
      setSuccess("บันทึกโปรไฟล์แล้ว");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container section narrow">
      <Title title="โปรไฟล์ของฉัน" description={a.session?.user.email} />
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <form className="panel stack" onSubmit={submit}>
        <Select label="คำนำหน้า" name="prefix" defaultValue={a.profile?.prefix}>
          {["นาย", "นาง", "นางสาว", "อื่น ๆ"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Field
          label="ชื่อ"
          name="first_name"
          defaultValue={a.profile?.first_name}
          required
          maxLength={100}
        />
        <Field
          label="นามสกุล"
          name="last_name"
          defaultValue={a.profile?.last_name}
          required
          maxLength={100}
        />
        <Field
          label="โทรศัพท์"
          name="phone"
          defaultValue={a.profile?.phone}
          required
          pattern="[0-9+ -]{9,20}"
        />
        <Submit busy={busy}>บันทึกโปรไฟล์</Submit>
        <Link className="btn outline" to="/change-password">
          เปลี่ยนรหัสผ่าน
        </Link>
      </form>
    </div>
  );
}
