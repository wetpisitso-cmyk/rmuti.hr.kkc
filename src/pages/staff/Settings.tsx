import { useState, useRef, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rows, rpc } from "../../services/api";
import { dateTH } from "../../lib/format";
import { supabase, supabaseUrl, publishableKey } from "../../lib/supabase";
import { paymentQrUrl } from "../../components/PaymentBankDetails";
import { errorTH } from "../../lib/errors";
import {
  Field,
  Textarea,
  State,
  Title,
  Notice,
  Submit,
} from "../../components/UI";
export default function Settings() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [usernameBusy, setUsernameBusy] = useState(false),
    [usernameError, setUsernameError] = useState(""),
    [usernameSuccess, setUsernameSuccess] = useState(""),
    [qrFile, setQrFile] = useState<File | null>(null),
    [paymentBusy, setPaymentBusy] = useState(false),
    [paymentError, setPaymentError] = useState(""),
    [paymentSuccess, setPaymentSuccess] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveResult, setDriveResult] = useState("");
  const [driveError, setDriveError] = useState("");
  const checkDrive = async () => {
    setDriveBusy(true); setDriveResult(""); setDriveError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("UNAUTHORIZED");
      const response = await fetch(`${supabaseUrl}/functions/v1/check-drive-connection`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const status = await response.json();
      if (!response.ok || !status.connected) {
        throw new Error(status.error || (status.folder_status === "no_write_access"
          ? "GDRIVE_FOLDER_WRITE_DENIED" : "GDRIVE_CONNECTION_FAILED"));
      }
      setDriveResult("เชื่อมต่อ Service Account และมีสิทธิ์สร้างไฟล์ใน Google Drive ของมหาวิทยาลัยแล้ว (ยังไม่ได้ทดสอบอัปโหลด)");
    } catch (error) {
      const code = error instanceof Error ? error.message : "GDRIVE_CONNECTION_FAILED";
      setDriveError("ตรวจสอบ Google Drive ไม่ผ่าน: " + code);
    } finally { setDriveBusy(false); }
  };
  const [testDriveBusy, setTestDriveBusy] = useState(false);
  const [testDriveMessage, setTestDriveMessage] = useState("");
  const [testDriveError, setTestDriveError] = useState("");
  const testDriveStorage = async () => {
    setTestDriveBusy(true);
    setTestDriveMessage(""); setTestDriveError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("UNAUTHORIZED");
      const response = await fetch(`${supabaseUrl}/functions/v1/test-drive-storage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const status = await response.json();
      if (!response.ok || !status.ok) {
        const explanation = [
          status.error || "GDRIVE_SMOKE_FAILED",
          status.uploaded ? "อัปโหลดแล้ว" : "ยังอัปโหลดไม่ได้",
          status.read_back ? "อ่านกลับได้" : "ยังอ่านกลับไม่ได้",
          status.moved_to_trash ? "ย้ายไฟล์ทดสอบลงถังขยะแล้ว" : "โปรดตรวจไฟล์ทดสอบที่อาจค้างใน Drive",
        ].join(" · ");
        throw new Error(explanation);
      }
      setTestDriveMessage("ผ่าน: อัปโหลดรูปตัวอย่าง อ่านกลับและย้ายลงถังขยะสำเร็จ (ไม่ใช้ข้อมูลผู้สมัคร)");
    } catch (e) {
      setTestDriveError(e instanceof Error ? e.message : "GDRIVE_SMOKE_FAILED");
    } finally { setTestDriveBusy(false); }
  };
  const [legacyTestBusy, setLegacyTestBusy] = useState(false);
  const [legacyTestResult, setLegacyTestResult] = useState("");
  const [legacyTestError, setLegacyTestError] = useState("");
  const testLegacyDriveReads = async () => {
    setLegacyTestBusy(true);
    setLegacyTestResult("");
    setLegacyTestError("");
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("กรุณาเข้าสู่ระบบแอดมินใหม่");
      const { data: samples, error: queryError } = await supabase
        .from("application_documents")
        .select("storage_path")
        .not("storage_path", "like", "%/gdrive/%")
        .limit(3);
      if (queryError) throw queryError;
      if (!samples || samples.length < 3) throw new Error("ไม่พบเอกสารเก่าสำหรับทดสอบครบ 3 รายการ");
      for (const sample of samples) {
        const { data: { session: active } } = await supabase.auth.getSession();
        if (!active) throw new Error("กรุณาเข้าสู่ระบบแอดมินใหม่");
        const response = await fetch(`${supabaseUrl}/functions/v1/read-drive-document`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${active.access_token}`,
            apikey: publishableKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: sample.storage_path }),
          cache: "no-store",
        });
        if (!response.ok) {
          const e = await response.json().catch(() => ({}));
          throw new Error(`เปิดเอกสารจาก Drive ไม่ผ่าน: ${e.error || response.status}`);
        }
        const contentType = response.headers.get("content-type") || "";
        const bytes = await response.arrayBuffer();
        if (!/^(application\/pdf|image\/jpeg|image\/png)/.test(contentType) || bytes.byteLength === 0) {
          throw new Error("รูปแบบข้อมูลจาก Drive ไม่ถูกต้อง");
        }
      }
      setLegacyTestResult("ผ่าน: เปิดเอกสารเก่าผ่าน Google Drive สำเร็จ 3/3 ไฟล์ (ยังไม่ลบไฟล์ Supabase)");
    } catch (e) {
      setLegacyTestError(e instanceof Error ? e.message : "LEGACY_DRIVE_READ_FAILED");
    } finally {
      setLegacyTestBusy(false);
    }
  };
  const [backupBusy,setBackupBusy] = useState(false);
  const [backupReport,setBackupReport] = useState("");
  const [backupError,setBackupError] = useState("");
  const backupStopRef = useRef(false);
  const startDriveBackup = async () => {
    setBackupBusy(true); setBackupReport(""); setBackupError("");
    backupStopRef.current = false;
    let batches = 0, checked = 0, failed = 0;
    const requestBatch = (token: string) => fetch(`${supabaseUrl}/functions/v1/admin-backup-drive-documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    try {
      for (let round = 0; round < 300 && !backupStopRef.current; round++) {
        // Obtain the current session for EACH batch; never cache a JWT over a long migration.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error("เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
        let response = await requestBatch(session.access_token);
        // Supabase can reject an expired JWT at the gateway before the function executes.
        // Refresh once, then retry the same idempotent batch; verified manifest rows are skipped.
        if (response.status === 401) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) {
            throw new Error("เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
          }
          response = await requestBatch(refreshed.session.access_token);
        }
        const result = await response.json().catch(() => ({ error: "BACKUP_RESPONSE_INVALID" }));
        if (!response.ok || !result.ok) {
          throw new Error(response.status === 401
            ? "เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
            : (result.error || "BACKUP_BATCH_FAILED"));
        }
        batches++;
        checked += result.verified || 0;
        failed += result.failed || 0;
        setBackupReport(`สำรองตรวจสอบผ่านเพิ่ม ${checked} ไฟล์ · รวมสำรองแล้ว ${result.remaining == null ? "ไม่ทราบ" : 1406 - result.remaining} จาก 1,406 ไฟล์ · ผิดพลาด ${failed} · เหลือ ${result.remaining ?? "ไม่ทราบ"} · ทำงาน ${batches} ชุด`);
        if (result.remaining === 0 || result.processed === 0 || (result.verified === 0 && result.failed > 0)) break;
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "BACKUP_BATCH_FAILED");
    } finally {
      setBackupBusy(false);
    }
  };
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const adminUsername = useQuery({
    queryKey: ["admin-own-username"],
    queryFn: () => rpc<string | null>("admin_get_own_username"),
  });
  const saveUsername = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUsernameBusy(true);
    setUsernameError("");
    setUsernameSuccess("");
    try {
      const username = String(new FormData(e.currentTarget).get("username") || "").trim().toLowerCase();
      await rpc("admin_set_own_username", { p_username: username });
      await qc.invalidateQueries({ queryKey: ["admin-own-username"] });
      setUsernameSuccess("บันทึกชื่อผู้ใช้ Admin สำเร็จแล้ว สามารถเข้าผ่านหน้า Login Admin ได้");
    } catch (e) { setUsernameError(errorTH(e)); }
    finally { setUsernameBusy(false); }
  };
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () =>
      rows(
        "audit_logs",
        "id,entity,action,metadata,created_at",
        "created_at",
        100,
      ),
  });
  const outbox = useQuery({
    queryKey: ["outbox"],
    queryFn: () =>
      rows(
        "email_outbox",
        "id,status,attempts,error_code,created_at",
        "created_at",
        100,
      ),
  });
  const c = q.data?.find((x) => x.key === "contact")?.value,
    p = q.data?.find((x) => x.key === "privacy")?.value,
    r = q.data?.find((x) => x.key === "retention")?.value,
    payment = q.data?.find((x) => x.key === "payment")?.value;
  const submit = async (e: FormEvent<HTMLFormElement>, key: string) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      if (key === "retention") data.months = Number(data.months) as any;
      await rpc("save_setting", { p_key: key, p_value: data });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      setSuccess("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  const savePayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPaymentBusy(true);
    setPaymentError("");
    setPaymentSuccess("");
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    let qrPath: string = payment?.qr_path || "";
    try {
      if (qrFile) {
        if (!["image/png", "image/jpeg"].includes(qrFile.type) || qrFile.size > 1048576 || qrFile.size === 0)
          throw new Error("กรุณาเลือก QR Code เป็น PNG หรือ JPG ขนาดไม่เกิน 1 MB");
        const ext = qrFile.type === "image/png" ? "png" : "jpg";
        const path = `qr/${crypto.randomUUID()}.${ext}`;
        const uploaded = await supabase.storage.from("recruitment-payment-qr")
          .upload(path, qrFile, { contentType: qrFile.type, upsert: false });
        if (uploaded.error) throw uploaded.error;
        qrPath = path;
      }
      await rpc("save_setting", { p_key: "payment", p_value: {
        bank_name: String(values.bank_name || "").trim(),
        account_name: String(values.account_name || "").trim(),
        account_number: String(values.account_number || "").trim(),
        qr_path: values.remove_qr === "on" ? "" : qrPath,
        note: String(values.note || "").trim(),
      } });
      setQrFile(null);
      form.reset();
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["payment-bank-settings"] });
      setPaymentSuccess("บันทึกบัญชีธนาคารและ QR Code สำเร็จแล้ว");
    } catch (e) {
      setPaymentError(e instanceof Error && e.message.startsWith("กรุณา") ? e.message : errorTH(e));
    } finally {
      setPaymentBusy(false);
    }
  };
  return (
    <>
      <Title title="ตั้งค่าและประวัติระบบ" />
      <form className="panel stack admin-username-settings" key={adminUsername.dataUpdatedAt} onSubmit={saveUsername}>
        <h2>ตั้ง Username สำหรับเข้าสู่ระบบ Admin</h2>
        <p className="muted">บัญชี Admin เดิมใช้รหัสผ่านเดิมใน Supabase Auth ไม่มีการสร้างรหัสผ่านใหม่หรือเก็บรหัสผ่านใน GitHub</p>
        {adminUsername.error && <Notice kind="error">{errorTH(adminUsername.error)}</Notice>}
        {usernameError && <Notice kind="error">{usernameError}</Notice>}
        {usernameSuccess && <Notice kind="success">{usernameSuccess}</Notice>}
        <div className="admin-username-fields">
          <Field label="Username Admin" name="username" defaultValue={adminUsername.data || ""} placeholder="เช่น hrkkc-admin" autoComplete="off"
            pattern="[a-z][a-z0-9._-]{3,31}" minLength={4} maxLength={32} required
            hint="ใช้ภาษาอังกฤษตัวพิมพ์เล็ก ขึ้นต้นด้วย a–z รวม 4–32 ตัวอักษร" />
          <button type="submit" className="btn primary" disabled={usernameBusy || adminUsername.isPending}>{usernameBusy ? "กำลังบันทึก…" : "บันทึก Username"}</button>
        </div>
        <small className="muted">เมื่อบันทึกแล้ว ให้เข้าสู่ระบบด้วย Username นี้และรหัสผ่านของบัญชี Admin ที่ <a className="text-link inline" href="#/admin/login">หน้าเข้าสู่ระบบ Admin</a></small>
      </form>
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <State loading={q.isPending} error={q.error}>
        <form
          key={q.dataUpdatedAt}
          onSubmit={(e) => submit(e, "contact")}
          className="panel stack"
        >
          <h2>ข้อมูลหน่วยงานและช่องทางติดต่อ</h2>
          <div className="form-grid">
            {[
              ["department", "หน่วยงานผู้ดูแล"],
              ["university", "ชื่อมหาวิทยาลัย"],
              ["phone", "โทรศัพท์"],
              ["email", "อีเมล"],
              ["hours", "เวลาติดต่อ"],
            ].map(([k, l]) => (
              <Field
                key={k}
                label={l}
                name={k}
                type={k === "email" ? "email" : "text"}
                defaultValue={c?.[k] || ""}
                required={["department", "university"].includes(k)}
              />
            ))}
          </div>
          <Textarea
            label="ที่อยู่"
            name="address"
            defaultValue={c?.address || ""}
          />
          <Submit busy={busy}>บันทึกข้อมูลติดต่อ</Submit>
        </form>
        <form
          key={`privacy-${q.dataUpdatedAt}`}
          onSubmit={(e) => submit(e, "privacy")}
          className="panel stack"
        >
          <h2>นโยบายข้อมูลส่วนบุคคล</h2>
          <Field
            label="เวอร์ชันนโยบาย"
            name="version"
            defaultValue={p?.version}
            required
          />
          <Textarea
            label="ข้อความนโยบายที่ผู้สมัครรับทราบ"
            name="text"
            defaultValue={p?.text}
            rows={8}
            required
          />
          <Submit busy={busy}>บันทึกนโยบาย</Submit>
        </form>
        <form
          key={`retention-${q.dataUpdatedAt}`}
          onSubmit={(e) => submit(e, "retention")}
          className="panel stack"
        >
          <h2>ระยะเวลาเก็บข้อมูล</h2>
          <Field
            label="จำนวนเดือน"
            name="months"
            type="number"
            min={1}
            max={120}
            defaultValue={r?.months || 24}
            required
          />
          <Textarea
            label="รายละเอียดนโยบาย / ผู้รับผิดชอบ"
            name="note"
            defaultValue={r?.note}
          />
          <small className="muted">
            ค่านี้ใช้เป็นนโยบายอ้างอิง ระบบไม่ลบข้อมูลอัตโนมัติ
            ขั้นตอนสำรองและทำลายข้อมูลอยู่ในคู่มือ
          </small>
          <Submit busy={busy}>บันทึกระยะเวลา</Submit>
        </form>
      </State>
      <section className="panel stack">
        <h2>บัญชีธนาคารและ QR Code รับชำระค่าธรรมเนียม</h2>
        <p className="muted">แสดงให้ผู้สมัครเฉพาะตำแหน่งที่มีค่าธรรมเนียม กรุณาใช้บัญชีที่หน่วยงานอนุมัติแล้วเท่านั้น</p>
        {paymentError && <Notice kind="error">{paymentError}</Notice>}
        {paymentSuccess && <Notice kind="success">{paymentSuccess}</Notice>}
        {payment?.qr_path && paymentQrUrl(payment.qr_path) && (
          <div className="payment-qr-admin-preview">
            <img alt="QR Code ปัจจุบัน" src={paymentQrUrl(payment.qr_path)} />
            <small>QR Code ที่ตั้งค่าไว้ในปัจจุบัน</small>
          </div>
        )}
        <form className="stack" key={`payment-${q.dataUpdatedAt}`} onSubmit={savePayment}>
          <div className="form-grid">
            <Field label="ชื่อธนาคาร" name="bank_name" defaultValue={payment?.bank_name || ""} required maxLength={100} placeholder="ชื่อธนาคารตามบัญชีจริง" />
            <Field label="ชื่อบัญชี" name="account_name" defaultValue={payment?.account_name || ""} required maxLength={160} />
            <Field label="เลขที่บัญชี" name="account_number" defaultValue={payment?.account_number || ""} required maxLength={30} pattern="[0-9][0-9 \\-]{5,29}" />
            <label className="field"><span>อัปโหลดรูป QR Code (PNG / JPG ไม่เกิน 1 MB)</span>
              <input type="file" accept="image/png,image/jpeg" onChange={e=>setQrFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <Textarea label="คำแนะนำเพิ่มเติม (ถ้ามี)" name="note" maxLength={500} defaultValue={payment?.note || ""} />
          {payment?.qr_path && <label className="checkbox"><input type="checkbox" name="remove_qr" /> ไม่แสดง QR Code เดิม (คงข้อมูลบัญชีไว้)</label>}
          <button type="submit" className="btn primary" disabled={paymentBusy}>{paymentBusy ? "กำลังบันทึก…" : "บันทึกข้อมูลรับชำระเงิน"}</button>
        </form>
      </section>
      <section className="panel stack">
        <h2>ตรวจสอบ Google Drive ของมหาวิทยาลัย</h2>
        <p className="muted">ตรวจเฉพาะ Service Account และสิทธิ์โฟลเดอร์ โดยไม่อัปโหลดหรือเปิดเผยเอกสารผู้สมัคร ระบบรับสมัครยังใช้ Supabase Storage จนกว่าจะผ่านการทดสอบและเปิดใช้งานโดยผู้ดูแล</p>
        <button type="button" className="btn outline" disabled={driveBusy} onClick={() => void checkDrive()}>
          {driveBusy ? "กำลังตรวจสอบ…" : "ตรวจการเชื่อมต่อ Google Drive"}
        </button>
        <p className="muted">การทดสอบต่อไปจะสร้างภาพตัวอย่าง 1 พิกเซลในโฟลเดอร์ที่กำหนด อ่านกลับเพื่อตรวจความถูกต้อง แล้วย้ายไฟล์ทดสอบลงถังขยะ โดยไม่แตะข้อมูลผู้สมัคร</p>
        <button type="button" className="btn outline" disabled={testDriveBusy} onClick={() => void testDriveStorage()}>
          {testDriveBusy ? "กำลังทดสอบอัปโหลด…" : "ทดสอบอัปโหลดและอ่านไฟล์ Google Drive"}
        </button>
        {testDriveMessage && <Notice kind="success">{testDriveMessage}</Notice>}
        {testDriveError && <Notice kind="error">ทดสอบไม่ผ่าน: {testDriveError}</Notice>}
        {driveResult && <Notice kind="success">{driveResult}</Notice>}
        {driveError && <Notice kind="error">{driveError}</Notice>}
      </section>
      <section className="panel stack">
        <h2>สำรองไฟล์ Supabase ไป Google Drive</h2>
        <p className="muted">คัดลอกเอกสารเก่าไป Google Drive ทีละ 5 ไฟล์ ตรวจ SHA-256 จากการอ่านกลับ บันทึกผลใน Supabase โดยไม่ลบต้นฉบับหรือเปลี่ยนไฟล์ที่ระบบผู้สมัครอ้างอิง</p>
        <p className="muted">ระหว่างสำรองให้เปิดหน้านี้ค้างไว้ การปิดหน้าจะหยุดสั่งงานชุดใหม่ แต่ชุดที่เริ่มไปแล้วสามารถตรวจสอบได้ในฐานข้อมูล</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn primary" disabled={backupBusy} onClick={()=>void startDriveBackup()}>
            {backupBusy?"กำลังสำรองและตรวจสอบ…":"เริ่มสำรองเอกสารไป Google Drive"}
          </button>
          {backupBusy && <button type="button" className="btn outline" onClick={()=>{backupStopRef.current=true;}}>หยุดหลังจบชุดปัจจุบัน</button>}
        </div>
        {backupReport && <Notice kind="success">{backupReport}</Notice>}
        {backupError && <Notice kind="error">หยุดการสำรอง: {backupError} — ต้นฉบับใน Supabase ยังอยู่</Notice>}
        <hr />
        <h3>ตรวจสอบก่อนคืนพื้นที่ Supabase Storage</h3>
        <p className="muted">ทดสอบเปิดเอกสารเก่า 3 ไฟล์ผ่าน Google Drive โดยใช้สิทธิ์แอดมินจริง ไม่แก้ข้อมูลผู้สมัคร ไม่ลบไฟล์ และไม่เปลี่ยนลิงก์ย้อนหลัง</p>
        <button type="button" className="btn outline" disabled={legacyTestBusy || backupBusy} onClick={() => void testLegacyDriveReads()}>
          {legacyTestBusy ? "กำลังทดสอบอ่านไฟล์…" : "ทดสอบเปิดเอกสารเก่าจาก Google Drive"}
        </button>
        {legacyTestResult && <Notice kind="success">{legacyTestResult}</Notice>}
        {legacyTestError && <Notice kind="error">ทดสอบไม่ผ่าน: {legacyTestError}</Notice>}
        <p className="muted">ยังไม่เปิดให้ลบต้นฉบับอัตโนมัติ จนกว่าทดสอบเอกสาร ประวัติ ใบสมัคร PDF และสำเนากู้คืนครบ</p>
      </section>
      <section className="panel">
        <h2>คิวอีเมลล่าสุด</h2>
        <State
          loading={outbox.isPending}
          error={outbox.error}
          empty={!outbox.data?.length}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>สถานะ</th>
                  <th>ครั้งที่พยายาม</th>
                  <th>รหัสข้อผิดพลาด</th>
                </tr>
              </thead>
              <tbody>
                {outbox.data?.map((x) => (
                  <tr key={x.id}>
                    <td>{dateTH(x.created_at, true)}</td>
                    <td>{x.status}</td>
                    <td>{x.attempts}</td>
                    <td>{x.error_code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
      <section className="panel">
        <h2>ประวัติการเปลี่ยนแปลงล่าสุด</h2>
        <State
          loading={audit.isPending}
          error={audit.error}
          empty={!audit.data?.length}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>ข้อมูล</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.map((x) => (
                  <tr key={x.id}>
                    <td>{dateTH(x.created_at, true)}</td>
                    <td>{x.entity}</td>
                    <td>{x.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
    </>
  );
}
