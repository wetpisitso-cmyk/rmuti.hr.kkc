import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rows, rpc } from "../../services/api";
import { errorTH } from "../../lib/errors";
import { Notice, State } from "../UI";

export const applicantMailEvents = [
  ["application_submitted", "สมัครงานสำเร็จ"],
  ["payment_confirmed", "ชำระค่าสมัครผ่านการตรวจสอบ"],
  ["eligibility_passed", "ผ่านคุณสมบัติ"],
  ["eligibility_failed", "ไม่ผ่านคุณสมบัติ"],
  ["exam_schedule_published", "ประกาศวัน เวลา สถานที่สอบ"],
  ["exam_card_issued", "ออกบัตรประจำตัวผู้สมัครสอบ"],
  ["selection_published", "ประกาศผลการสอบ"],
] as const;

type MailSettings = { enabled?: boolean; events?: string[]; active_since?: string | null };

export default function ApplicantMailSettings() {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: ["applicant-mail-settings"],
    queryFn: async (): Promise<MailSettings> => {
      const data = await rows<{ key: string; value: MailSettings }>("app_settings", "key,value", "key");
      return data.find((x) => x.key === "applicant_mail")?.value || { enabled: false, events: [] };
    },
  });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const settings = config.data;
  const events = selected ?? settings?.events ?? [];
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      // Selection is saved in disabled mode only; activating the sender must be
      // a separate deliberate step after approving a provider and testing.
      await rpc("admin_set_applicant_mail_settings", { p_enabled: false, p_events: events });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["applicant-mail-settings"] }),
        qc.invalidateQueries({ queryKey: ["settings"] }),
      ]);
      setSelected(null);
      setSuccess("บันทึกหัวข้อเรียบร้อยแล้ว ระบบยังไม่ส่งอีเมลจนกว่าจะตั้งค่าและเปิดใช้งานบริการส่ง");
    } catch (err) {
      setError(errorTH(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel stack">
      <h2>แจ้งเตือนผู้สมัครผ่านอีเมล</h2>
      <p className="muted">เลือกเหตุการณ์ที่ต้องการแจ้งผู้สมัคร เมื่อบริการส่งเมลได้รับการอนุมัติและเปิดใช้งานแล้ว ระบบจะส่งเฉพาะเหตุการณ์ที่เกิดขึ้นใหม่ ไม่ส่งย้อนหลังถึงผู้สมัครเดิม</p>
      <State loading={config.isPending} error={config.error}>
        <p><strong>สถานะการส่ง:</strong> {settings?.enabled ? "เปิดใช้งาน" : "ปิดการส่ง (โหมดเตรียมพร้อม)"}</p>
        <form className="stack" onSubmit={save}>
          {applicantMailEvents.map(([key, label]) => (
            <label className="checkbox" key={key}>
              <input type="checkbox" checked={events.includes(key)}
                onChange={(e) => setSelected(e.target.checked
                  ? [...events, key] : events.filter((item) => item !== key))}/>
              {label}
            </label>
          ))}
          {error && <Notice kind="error">{error}</Notice>}
          {success && <Notice kind="success">{success}</Notice>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึกรายการแจ้งเตือน (ยังไม่ส่งจริง)"}
          </button>
        </form>
        <p className="muted">การเปิดใช้งานต้องตั้งค่า RESEND_API_KEY, MAIL_FROM, WORKER_SECRET และทดสอบช่องทางส่งก่อน ห้ามใส่คีย์ใน GitHub หรือหน้าผู้สมัคร</p>
      </State>
    </section>
  );
}
