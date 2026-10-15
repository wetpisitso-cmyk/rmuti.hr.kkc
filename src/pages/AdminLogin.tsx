import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, ArrowRight, UserRound } from "lucide-react";
import { supabase, supabaseUrl, publishableKey } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Field, Notice } from "../components/UI";

const codes: Record<string,string> = {
  INVALID_ADMIN_CREDENTIALS:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  ADMIN_LOGIN_RATE_LIMITED:"ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอประมาณ 15 นาทีแล้วลองใหม่",
  SERVICE_UNAVAILABLE:"ระบบเข้าสู่ระบบ Admin ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่",
  INVALID_INPUT:"กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน",
  ORIGIN_NOT_ALLOWED:"ไม่สามารถเข้าสู่ระบบจากเว็บไซต์นี้",
};
export default function AdminLogin() {
  const auth = useAuth();
  const nav = useNavigate();
  const [show,setShow] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  if (!auth.loading && auth.session && auth.role==="admin") {
    return <Navigate to="/staff" replace/>;
  }
  const signIn = async (e:FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const username=String(form.get("username") || "").trim().toLowerCase();
    const password=String(form.get("password") || "");
    if (!/^[a-z][a-z0-9._-]{3,31}$/.test(username)) {
      setError("ชื่อผู้ใช้ต้องเป็นอักษรอังกฤษพิมพ์เล็กขึ้นต้น ตามด้วยตัวเลข จุด ขีดล่าง หรือขีดกลาง รวม 4–32 ตัวอักษร");
      return;
    }
    setBusy(true); setError("");
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-login`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":publishableKey},
        body:JSON.stringify({username,password}),
        cache:"no-store",
      });
      const body: {access_token?:string;refresh_token?:string;error?:string} = await res.json();
      if (!res.ok || !body.access_token || !body.refresh_token)
        throw new Error(body.error || "SERVICE_UNAVAILABLE");
      const {data,error:sessionError}=await supabase.auth.setSession({
        access_token:body.access_token, refresh_token:body.refresh_token,
      });
      if (sessionError || !data.user) throw new Error("SERVICE_UNAVAILABLE");
      const roleCheck=await supabase.from("user_roles").select("role").eq("user_id",data.user.id).single();
      if (roleCheck.error || roleCheck.data?.role!=="admin") {
        await supabase.auth.signOut();
        throw new Error("INVALID_ADMIN_CREDENTIALS");
      }
      nav("/staff",{replace:true});
    } catch(e) {
      const code=e instanceof Error?e.message:"SERVICE_UNAVAILABLE";
      setError(codes[code] || codes.SERVICE_UNAVAILABLE);
    } finally {setBusy(false);}
  };
  return <div className="admin-login-shell">
    <div className="admin-login-top">
      <Link to="/" className="admin-login-brand">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ตรามหาวิทยาลัยราชมงคลอีสาน"/>
        <span><strong>RMUTI KKC</strong><small>ระบบรับสมัครบุคลากร วิทยาเขตขอนแก่น</small></span>
      </Link>
      <Link to="/" className="admin-login-back">กลับหน้าเว็บไซต์ <ArrowRight size={16}/></Link>
    </div>
    <div className="admin-login-grid">
      <div className="admin-login-story">
        <span className="admin-login-eyebrow"><ShieldCheck size={16}/> SECURE ADMIN PORTAL</span>
        <h1>พื้นที่จัดการ<br/><span>สำหรับผู้ดูแลระบบ</span></h1>
        <p>เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านส่วนตัวของ Admin เพื่อตรวจสอบใบสมัคร จัดการประกาศ และรับรองเอกสาร</p>
        <img src={`${import.meta.env.BASE_URL}rmuti-building.webp`} alt="อาคารมหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น"/>
      </div>
      <section className="admin-login-card">
        <div className="admin-login-lock"><LockKeyhole size={27}/></div>
        <div className="eyebrow">ADMINISTRATOR LOGIN</div>
        <h2>เข้าสู่ระบบ Admin</h2>
        <p className="muted">ใช้ Username และ Password ที่ได้รับสิทธิ์ Admin</p>
        {error && <Notice kind="error">{error}</Notice>}
        <form className="stack" onSubmit={signIn}>
          <Field label="Username" name="username" autoComplete="username" placeholder="กรอกชื่อผู้ใช้ Admin" minLength={4} maxLength={32} required/>
          <div className="password-field">
            <Field label="Password" name="password" type={show?"text":"password"} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" required/>
            <button className="icon-btn" type="button" aria-label={show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน"} onClick={()=>setShow(!show)}>{show?<EyeOff size={19}/>:<Eye size={19}/>}</button>
          </div>
          <button className="btn primary w-full" type="submit" disabled={busy}>{busy?"กำลังตรวจสอบ…":"เข้าสู่ระบบผู้ดูแล"} <ArrowRight size={18}/></button>
        </form>
        <div className="admin-login-foot"><ShieldCheck size={17}/> จำกัดเฉพาะบัญชีที่ได้รับสิทธิ์ Admin จากระบบเท่านั้น</div>
        <p className="admin-login-help">ตั้ง Username ครั้งแรก? Admin เดิมเข้าสู่ระบบด้วยอีเมลที่ <Link to="/login">หน้าเข้าสู่ระบบปกติ</Link> แล้วตั้ง Username ในเมนูตั้งค่าระบบ</p>
        <div className="admin-login-applicant"><UserRound size={16}/> สำหรับผู้สมัครทั่วไป <Link to="/login">เข้าสู่ระบบผู้สมัคร</Link></div>
      </section>
    </div>
  </div>;
}
