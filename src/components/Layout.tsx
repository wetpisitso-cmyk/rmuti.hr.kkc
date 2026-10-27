import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Files,
  FileSpreadsheet,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Users,
  Settings,
  ClipboardCheck,
  Megaphone,
  ShieldCheck,
  ArrowUpRight,
  BookOpenCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { rows } from "../services/api";
export function Brand({ inHeader = false }: { inHeader?: boolean } = {}) {
  const [logo, setLogo] = useState(true);
  return (
    <Link to="/" className={inHeader ? "brand header-brand" : "brand"}>
      {inHeader ? (
        logo ? (
          <img
            className="header-crest"
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="ตรามหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน"
            width={54}
            height={68}
            onError={() => setLogo(false)}
          />
        ) : (
          <GraduationCap className="header-crest-fallback" size={40} aria-hidden="true" />
        )
      ) : (
        <span className="brand-mark">
          {logo ? (
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="ตรามหาวิทยาลัย"
              onError={() => setLogo(false)}
            />
          ) : (
            <GraduationCap size={28} />
          )}
        </span>
      )}
      <span>
        <strong>
          RMUTI <span>KHON KAEN</span>
        </strong>
        <small>ระบบรับสมัครบุคลากรออนไลน์</small>
      </span>
    </Link>
  );
}
export function Layout() {
  const a = useAuth(),
    nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const contact = settings?.find((s) => s.key === "contact")?.value;
  const logout = async () => {
    await supabase.auth.signOut();
    nav("/");
    setOpen(false);
  };
  return (
    <>
      <header className="header">
        <div className="university-topbar">
          <div className="container university-topbar-inner">
            <span>มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน · วิทยาเขตขอนแก่น</span>
            <span><strong>RMUTI KKC</strong> / HUMAN RESOURCES RECRUITMENT</span>
          </div>
        </div>
        <div className="container header-inner">
          <Brand inHeader />
          <button
            className="icon-btn mobile-only"
            aria-label="เปิดเมนู"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            className={open ? "main-nav open" : "main-nav"}
            onClick={() => setOpen(false)}
          >
            <NavLink to="/" end>
              ตำแหน่งเปิดรับ
            </NavLink>
            <NavLink to="/announcements">ประกาศ</NavLink>
            <NavLink to="/results">ผลคัดเลือก</NavLink>
            <NavLink to="/guide">คู่มือผู้สมัคร / ติดต่อ</NavLink>
            {a.session ? (
              <>
                <Link
                  className="btn small outline"
                  to={a.role === "applicant" ? "/dashboard" : "/staff"}
                >
                  {a.role === "applicant"
                    ? "ใบสมัครของฉัน"
                    : "หน้าสำหรับเจ้าหน้าที่"}
                </Link>
                <button
                  className="icon-btn"
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                  onClick={logout}
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <Link className="btn small primary" to="/login">
                เข้าสู่ระบบ <ArrowUpRight size={16} />
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <Brand />
          <p>
            {contact?.department || "แผนกงานบริหารงานบุคคล"}
            <br />
            มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น
          </p>
          <span>
            <ShieldCheck size={17} /> เอกสารส่วนบุคคลเข้าถึงตามสิทธิ์
            <Link className="footer-admin-link" to="/admin/login">เข้าสู่ระบบ Admin</Link>
          </span>
        </div>
      </footer>
    </>
  );
}
const links = [
  ["", "ภาพรวม", LayoutDashboard, ""],
  ["applications", "ตรวจใบสมัคร", Files, "review"],
  ["roster", "รายชื่อผู้สมัคร / PDF / Excel", FileSpreadsheet, "reports"],
  ["jobs", "ตำแหน่งรับสมัคร", BriefcaseBusiness, "manage_jobs"],
  ["rounds", "รอบรับสมัคร", CalendarDays, "manage_jobs"],
  ["departments", "หน่วยงาน", Building2, "manage_jobs"],
  ["exams", "การสอบและคะแนน", ClipboardCheck, "exams"],
  ["exam-cards", "จัดการบัตรประจำตัวผู้สมัครสอบ", FileSpreadsheet, "exams"],
  ["publish", "ประกาศและเผยแพร่", Megaphone, "publish"],
  ["users", "บัญชีและสิทธิ์", Users, "admin"],
  ["settings", "ตั้งค่า / ประวัติ", Settings, "admin"],
  ["guide", "คู่มือการใช้งาน Admin", BookOpenCheck, "admin"],
] as const;
export function StaffLayout() {
  const a = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="staff-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-heading">
          <div className="sidebar-campus-badge">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ตรามหาวิทยาลัย"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <div><strong>RMUTI KKC</strong><small>HUMAN RESOURCES</small></div>
          </div>
          <span className="eyebrow">HR WORKSPACE</span>
          <h2>จัดการการรับสมัคร</h2>
          <small>
            {a.profile?.first_name} {a.profile?.last_name} ·{" "}
            {a.role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}
          </small>
        </div>
        {links
          .filter((l) => !l[3] || a.can(l[3]))
          .map(([p, label, Icon]) => (
            <NavLink
              key={p}
              end={p === ""}
              to={`/staff${p ? "/" + p : ""}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        <div className="sidebar-note">
          ทุกการเปลี่ยนสถานะมีประวัติ
          <br />
          ตรวจข้อมูลก่อนเผยแพร่ผล
        </div>
      </aside>
      <section className="staff-main">
        <button
          className="btn outline mobile-only mb-4"
          onClick={() => setOpen(!open)}
        >
          <Menu size={18} /> เมนูเจ้าหน้าที่
        </button>
        <Outlet />
      </section>
    </div>
  );
}
