import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { State, Notice } from "./UI";
export function Guard({
  staff = false,
  permission,
}: {
  staff?: boolean;
  permission?: string;
}) {
  const a = useAuth(),
    location = useLocation();
  if (a.loading) return <State loading>{null}</State>;
  if (!a.session)
    return <Navigate to={staff ? "/admin/login" : "/login"} state={{ from: location.pathname }} replace />;
  if ((staff && a.role === "applicant") || (permission && !a.can(permission)))
    return (
      <div className="container section">
        <Notice kind="error">คุณไม่มีสิทธิ์ใช้งานส่วนนี้</Notice>
      </div>
    );
  return <Outlet />;
}
