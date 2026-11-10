import { useState } from "react";
import { rpc } from "../../services/api";
import { Notice, Title } from "../../components/UI";

type Account = {
  email: string;
  role: string;
  applications: Array<{
    id: string; status: string; application_number: string | null;
    title: string; documents: Array<{ file_name: string }>;
  }>;
};

export default function TestAccounts() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function preview() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await rpc<Account>("admin_preview_test_account", { p_email: email.trim() });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถตรวจสอบบัญชีได้");
    } finally { setBusy(false); }
  }
  return <div className="stack">
    <Title title="จัดการบัญชีทดสอบ" description="ตรวจสอบข้อมูลก่อนดำเนินการ เฉพาะผู้ดูแลระบบเท่านั้น" />
    <Notice>การรีเซ็ตใบสมัครและการลบบัญชีถาวรยังไม่เปิดใช้ จนกว่าจะติดตั้งและตรวจสอบบริการฝั่งเซิร์ฟเวอร์ครบถ้วน</Notice>
    <section className="panel stack">
      <h2>ตรวจสอบข้อมูลก่อนลบ</h2>
      <label htmlFor="test-account-email">อีเมลบัญชีทดสอบ</label>
      <input id="test-account-email" type="email" value={email}
        onChange={e => { setEmail(e.target.value); setResult(null); }}
        placeholder="test@example.com" autoComplete="off" />
      <button type="button" className="btn primary" onClick={() => void preview()} disabled={busy || !email.includes("@")}>{busy ? "กำลังตรวจสอบ…" : "ดูรายการใบสมัครและเอกสาร"}</button>
      {error && <Notice kind="error">{error}</Notice>}
    </section>
    {result && <section className="panel stack">
      <h2>ผลการตรวจสอบ</h2>
      <p>อีเมล: {result.email} · บทบาท: {result.role}</p>
      <p>ใบสมัคร {result.applications.length} รายการ</p>
      {result.applications.map(app => <div key={app.id} className="panel">
        <strong>{app.title}</strong>
        <p>{app.application_number || "ยังไม่มีเลขผู้สมัคร"} · {app.status}</p>
        <p>เอกสาร {app.documents.length} รายการ</p>
        <ul>{app.documents.map((doc,i) => <li key={i}>{doc.file_name}</li>)}</ul>
      </div>)}
      <button className="btn outline" type="button" disabled>รีเซ็ตใบสมัคร — ยังไม่เปิดใช้งาน</button>
      <button className="btn danger" type="button" disabled>ลบบัญชีทดสอบถาวร — ยังไม่เปิดใช้งาน</button>
    </section>}
  </div>;
}
