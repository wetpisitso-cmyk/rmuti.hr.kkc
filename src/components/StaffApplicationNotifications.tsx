import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { dateTH } from "../lib/format";
import { errorTH } from "../lib/errors";

type StaffNotice = {
  id: string;
  application_id: string | null;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export default function StaffApplicationNotifications() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const enabled = !!auth.session && (auth.role === "admin" || auth.role === "hr");
  const notices = useQuery({
    queryKey: ["staff-application-notifications", auth.session?.user.id],
    enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications")
        .select("id,application_id,title,message,read_at,created_at")
        .eq("user_id", auth.session!.user.id)
        .like("event_key", "staff-application:%")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as StaffNotice[];
    },
  });
  const unread = notices.data?.filter((n) => !n.read_at).length || 0;
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["staff-application-notifications"] }),
      qc.invalidateQueries({ queryKey: ["header-notification-count"] }),
    ]);
  };
  const markRead = async (id: string) => {
    setError("");
    const { error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", auth.session!.user.id).is("read_at", null);
    if (error) setError(errorTH(error));
    else await refresh();
  };
  const markAllRead = async () => {
    setError("");
    const { error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.session!.user.id)
      .like("event_key", "staff-application:%")
      .is("read_at", null);
    if (error) setError(errorTH(error));
    else await refresh();
  };
  if (!enabled) return null;
  return (
    <section id="staff-notifications" className="panel staff-application-notifications">
      <div className="staff-notice-heading">
        <div>
          <h2><Bell size={22} aria-hidden="true" /> แจ้งเตือนผู้สมัคร {unread > 0 && <span className="staff-notice-count">{unread} ยังไม่อ่าน</span>}</h2>
          <p className="muted">ผู้สมัครใหม่และผู้ที่ส่งเอกสารแก้ไขกลับมา · อัปเดตอัตโนมัติทุก 20 วินาที</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn outline small" onClick={() => void notices.refetch()}>
            <RefreshCw size={16} /> รีเฟรช
          </button>
          {unread > 0 && <button type="button" className="btn outline small" onClick={() => void markAllRead()}>
            <CheckCheck size={16} /> อ่านทั้งหมด
          </button>}
        </div>
      </div>
      {error && <p role="alert" className="notice error">{error}</p>}
      {notices.error && <p role="alert" className="notice error">ไม่สามารถโหลดการแจ้งเตือนได้: {errorTH(notices.error)}</p>}
      {notices.isPending && <p className="muted">กำลังโหลดการแจ้งเตือน…</p>}
      {notices.isSuccess && !notices.data.length && <p className="muted">ยังไม่มีรายการแจ้งเตือนใหม่</p>}
      <div className="staff-notice-list">
        {notices.data?.map((n) => (
          <div className={`staff-notice-item ${n.read_at ? "is-read" : "is-unread"}`} key={n.id}>
            <div className="staff-notice-body">
              <strong>{n.title}</strong>
              <p>{n.message}</p>
              <small>{dateTH(n.created_at, true)} {n.read_at ? "· อ่านแล้ว" : "· ยังไม่อ่าน"}</small>
            </div>
            <div className="staff-notice-actions">
              {n.application_id && <Link className="btn primary small" to={`/staff/applications/${n.application_id}`} onClick={() => { if (!n.read_at) void markRead(n.id); }}>
                เปิดใบสมัคร <ArrowRight size={15} />
              </Link>}
              {!n.read_at && <button type="button" className="btn outline small" onClick={() => void markRead(n.id)}>อ่านแล้ว</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
