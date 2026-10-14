import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, LockKeyhole, ArrowLeft } from "lucide-react";
import { baseUrl, supabase } from "../lib/supabase";
import { errorTH } from "../lib/errors";
import { registrationSchema, passwordSchema } from "../validation/forms";
import { rows } from "../services/api";
import { Field, Select, Notice, Submit } from "../components/UI";
import { useAuth } from "../hooks/useAuth";
export default function AuthPage({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset" | "change";
}) {
  const nav = useNavigate(),
    location = useLocation(),
    auth = useAuth();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(() =>
      mode === "forgot" ? sessionStorage.getItem("recovery-error") || "" : "",
    ),
    [success, setSuccess] = useState("");
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const policy = q.data?.find((s) => s.key === "privacy")?.value;
  const titles = {
    login: "เข้าสู่ระบบ",
    register: "สมัครสมาชิก",
    forgot: "ลืมรหัสผ่าน",
    reset: "ตั้งรหัสผ่านใหม่",
    change: "เปลี่ยนรหัสผ่าน",
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    sessionStorage.removeItem("recovery-error");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      if (mode === "register") {
        const parsed = registrationSchema.safeParse({
          ...data,
          consent: data.consent === "on",
        });
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        if (!policy?.version) throw new Error("POLICY_UNAVAILABLE");
        const d = parsed.data;
        const r = await supabase.auth.signUp({
          email: d.email,
          password: d.password,
          options: {
            data: {
              prefix: d.prefix,
              first_name: d.first_name,
              last_name: d.last_name,
              phone: d.phone,
              consent_version: policy.version,
            },
          },
        });
        if (r.error) throw r.error;
        if (!r.data.session) {
          setError(
            "บัญชีถูกสร้างแล้ว แต่ยังเข้าสู่ระบบไม่ได้ กรุณาให้ผู้ดูแลปิด Confirm Email ใน Supabase ตามคู่มือ",
          );
          return;
        }
        nav("/dashboard", { replace: true });
      } else if (mode === "login") {
        const r = await supabase.auth.signInWithPassword({
          email: String(data.email),
          password: String(data.password),
        });
        if (r.error) throw r.error;
        const from = location.state?.from;
        nav(
          typeof from === "string" && from.startsWith("/")
            ? from
            : "/dashboard",
          { replace: true },
        );
      } else if (mode === "forgot") {
        const r = await supabase.auth.resetPasswordForEmail(
          String(data.email),
          { redirectTo: baseUrl() + "?auth=recovery" },
        );
        if (r.error) throw r.error;
        setSuccess(
          "หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจกล่องจดหมายและจดหมายขยะ",
        );
      } else {
        const parsed = passwordSchema.safeParse(data);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("UNAUTHORIZED");
        const r = await supabase.auth.updateUser({
          password: parsed.data.password,
        });
        if (r.error) throw r.error;
        await supabase.auth.signOut();
        setSuccess("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg.startsWith("กรุณา") ||
          msg.startsWith("รหัสผ่าน") ||
          msg === "อีเมลไม่ถูกต้อง" ||
          msg === "เบอร์โทรศัพท์ไม่ถูกต้อง"
          ? msg
          : errorTH(e),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="eyebrow">RMUTI KHON KAEN</div>
        <h1>
          ก้าวต่อไป
          <br />
          ของการทำงาน
          <br />
          <span>เริ่มต้นที่นี่</span>
        </h1>
        <p>
          สมัครและติดตามผลการคัดเลือก
          <br />
          ได้ผ่านบัญชีของคุณ
        </p>
        <div className="auth-campus-image" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}rmuti-building.webp`} alt=""
            loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="auth-security-note"><LockKeyhole size={17} /> ระบบบัญชีสมาชิกสำหรับผู้สมัครและเจ้าหน้าที่</div>
      </aside>
      <section className="auth-box">
        <Link to="/" className="breadcrumb">
          <ArrowLeft size={16} /> กลับหน้าหลัก
        </Link>
        <h1>{titles[mode]}</h1>
        <p className="muted">
          {mode === "register"
            ? "สร้างบัญชีด้วยอีเมลและรหัสผ่าน"
            : "ระบบรับสมัครบุคลากรออนไลน์ มทร.อีสาน ขอนแก่น"}
        </p>
        {error && <Notice kind="error">{error}</Notice>}
        {success && <Notice kind="success">{success}</Notice>}
        <form onSubmit={submit} className="stack">
          {mode === "register" && (
            <>
              <Select label="คำนำหน้า" name="prefix" required defaultValue="">
                <option value="">เลือกคำนำหน้า</option>
                {["นาย", "นาง", "นางสาว", "อื่น ๆ"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <div className="form-grid">
                <Field
                  label="ชื่อ"
                  name="first_name"
                  required
                  autoComplete="given-name"
                />
                <Field
                  label="นามสกุล"
                  name="last_name"
                  required
                  autoComplete="family-name"
                />
              </div>
              <Field
                label="เบอร์โทรศัพท์"
                name="phone"
                required
                autoComplete="tel"
                maxLength={20}
              />
            </>
          )}
          {["login", "register", "forgot"].includes(mode) && (
            <Field
              label="อีเมล"
              type="email"
              name="email"
              required
              autoComplete="email"
            />
          )}
          {mode !== "forgot" && (
            <div className="password-field">
              <Field
                label={
                  mode === "reset" || mode === "change"
                    ? "รหัสผ่านใหม่"
                    : "รหัสผ่าน"
                }
                name="password"
                type={show ? "text" : "password"}
                minLength={8}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                hint={mode === "login" ? undefined : "อย่างน้อย 8 ตัวอักษร"}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          )}
          {["register", "reset", "change"].includes(mode) && (
            <Field
              label="ยืนยันรหัสผ่าน"
              name="confirm"
              type={show ? "text" : "password"}
              minLength={8}
              required
              autoComplete="new-password"
            />
          )}
          {mode === "register" && (
            <>
              <details>
                <summary>
                  นโยบายข้อมูลส่วนบุคคล ({policy?.version || "กำลังโหลด"})
                </summary>
                <p className="pre-wrap">{policy?.text}</p>
              </details>
              <label className="checkbox">
                <input type="checkbox" name="consent" required />
                ฉันรับทราบนโยบายการใช้ข้อมูลส่วนบุคคล
              </label>
            </>
          )}
          <Submit busy={busy}>
            {mode === "forgot" ? "ส่งลิงก์ตั้งรหัสผ่าน" : titles[mode]}
          </Submit>
          {mode === "login" && (
            <div className="auth-links">
              <Link to="/forgot-password">ลืมรหัสผ่าน</Link>
              <Link to="/register">สมัครสมาชิก</Link>
            </div>
          )}
          {mode === "register" && (
            <p className="text-center">
              มีบัญชีแล้ว?{" "}
              <Link className="text-link inline" to="/login">
                เข้าสู่ระบบ
              </Link>
            </p>
          )}
          {(mode === "forgot" || success) && (
            <Link className="text-link" to="/login">
              กลับไปเข้าสู่ระบบ
            </Link>
          )}
          {mode === "reset" && !auth.session && !auth.loading && (
            <Notice>หากลิงก์หมดอายุ ให้ขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน</Notice>
          )}
        </form>
      </section>
    </div>
  );
}
