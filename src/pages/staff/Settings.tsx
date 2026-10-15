import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rows, rpc } from "../../services/api";
import { dateTH } from "../../lib/format";
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
    [usernameSuccess, setUsernameSuccess] = useState("");
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
    r = q.data?.find((x) => x.key === "retention")?.value;
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
