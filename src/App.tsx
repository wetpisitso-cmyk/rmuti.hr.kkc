import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { Layout, StaffLayout } from "./components/Layout";
import { Guard } from "./components/Guard";
import { State, Notice } from "./components/UI";
import { configured } from "./lib/supabase";
import { Home, JobDetail, Announcements, AnnouncementDetail, Results } from "./pages/Public";
// Critical applicant flow should not depend on a delayed chunk on stale mobile tabs.
import Wizard from "./pages/ApplicationWizard";
const ApplicantGuide = lazy(() => import("./pages/ApplicantGuide"));
const AdminGuide = lazy(() => import("./pages/staff/AdminGuide"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.ProfilePage })),
);
const Application = lazy(() => import("./pages/ApplicationView"));
const PaymentReceipt = lazy(() => import("./pages/PaymentReceipt"));
const Print = lazy(() =>
  import("./pages/ApplicationView").then((m) => ({
    default: m.PrintApplication,
  })),
);
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const ApplicantRoster = lazy(() => import("./pages/staff/ApplicantRoster"));
const Catalog = lazy(() => import("./pages/staff/Catalog"));
const Review = lazy(() => import("./pages/staff/Review"));
const Exams = lazy(() => import("./pages/staff/Exams"));
const Publish = lazy(() => import("./pages/staff/Publish"));
const Users = lazy(() => import("./pages/staff/Users"));
const Settings = lazy(() => import("./pages/staff/Settings"));
export default function App() {
  if (!configured)
    return (
      <div className="container section">
        <Notice kind="error">
          ยังไม่ได้ตั้งค่าการเชื่อมต่อ กรุณาตั้ง VITE_SUPABASE_URL และ
          VITE_SUPABASE_PUBLISHABLE_KEY ตาม README แล้ว build ใหม่
        </Notice>
      </div>
    );
  return (
    <HashRouter>
      <Suspense fallback={<State loading>{null}</State>}>
        <Routes>
          <Route path="admin/login" element={<AdminLogin />} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="announcements/:id" element={<AnnouncementDetail />} />
            <Route path="results" element={<Results />} />
            <Route path="guide" element={<ApplicantGuide />} />
            <Route path="login" element={<Auth mode="login" />} />
            <Route path="register" element={<Auth mode="register" />} />
            <Route path="forgot-password" element={<Auth mode="forgot" />} />
            <Route path="reset-password" element={<Auth mode="reset" />} />
            <Route element={<Guard />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="change-password" element={<Auth mode="change" />} />
              <Route path="apply/:jobId" element={<Wizard />} />
              <Route path="application/:id/edit" element={<Wizard />} />
              <Route path="application/:id" element={<Application />} />
              <Route path="application/:id/print" element={<Print />} />
              <Route path="application/:id/receipt" element={<PaymentReceipt />} />
              <Route path="application/:id/exam" element={<Print exam />} />
            </Route>
            <Route element={<Guard staff />}>
              <Route path="staff" element={<StaffLayout />}>
                <Route index element={<StaffDashboard />} />
                <Route
                  path="applications"
                  element={<StaffDashboard listOnly />}
                />
                <Route element={<Guard permission="reports" />}>
                  <Route path="roster" element={<ApplicantRoster />} />
                </Route>
                <Route path="applications/:id" element={<Review />} />
                <Route element={<Guard permission="manage_jobs" />}>
                  <Route
                    path="jobs"
                    element={<Catalog table="job_positions" />}
                  />
                  <Route
                    path="rounds"
                    element={<Catalog table="recruitment_rounds" />}
                  />
                  <Route
                    path="departments"
                    element={<Catalog table="departments" />}
                  />
                </Route>
                <Route element={<Guard permission="exams" />}>
                  <Route path="exams" element={<Exams />} />
                </Route>
                <Route element={<Guard permission="publish" />}>
                  <Route path="publish" element={<Publish />} />
                </Route>
                <Route element={<Guard permission="admin" />}>
                  <Route path="guide" element={<AdminGuide />} />
                  <Route path="users" element={<Users />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>
            </Route>
            <Route
              path="*"
              element={
                <div className="container section">
                  <h1>ไม่พบหน้าที่ต้องการ</h1>
                  <Link to="/" className="btn primary">
                    กลับหน้าหลัก
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
