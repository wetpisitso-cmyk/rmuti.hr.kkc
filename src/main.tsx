import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { initializeRecovery } from "./lib/supabase";
import "./styles.css";
import "./premium-theme.css";
import "./campus-design.css";
import "./official-application.css";
import "./apple-inspired-ui.css";
import "./admin-login.css";
import "./vibrant-home.css";
import "./manual-guides.css";
import "./readability.css";
import "./admin-frames.css";
// Handle stale Vite chunks after GitHub Pages publishes a new build.
// Preserve hash routes so users can resume their applications.
const FRESH_PARAM = "rmuti_fresh";
function freshUrl(preserveRoute: boolean) {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set(FRESH_PARAM, String(Date.now()));
  if (preserveRoute) url.hash = window.location.hash;
  return url.toString();
}
function reloadFresh() {
  // Update URL within this tab before reloading, rather than navigating
  // the in-app browser to a new URL (which can close embedded browser tabs).
  window.history.replaceState(null, "", freshUrl(true));
  window.location.reload();
}
function recoverChunkOnce() {
  if (!new URL(window.location.href).searchParams.has(FRESH_PARAM)) reloadFresh();
}
function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror|loading chunk .*failed|load failed/i.test(message);
}
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverChunkOnce();
});
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; kind: "asset" | "render" }
> {
  state: { failed: boolean; kind: "asset" | "render" } = {
    failed: false,
    kind: "render",
  };
  static getDerivedStateFromError(error: Error) {
    return { failed: true, kind: isStaleChunkError(error) ? "asset" : "render" };
  }
  componentDidCatch(error: Error) {
    if (isStaleChunkError(error)) recoverChunkOnce();
  }
  goHome = () => {
    // Recover inside the current browser tab, even in embedded iPhone browsers.
    // A full navigation can close some in-app browser windows.
    window.location.hash = "#/";
    this.setState({ failed: false, kind: "render" });
  };
  render() {
    return this.state.failed ? (
      <div className="container section">
        <h1>ไม่สามารถแสดงหน้านี้ได้</h1>
        <p>
          {this.state.kind === "asset"
            ? "ไฟล์หน้าเว็บไม่ตรงกับเวอร์ชันล่าสุด กรุณาโหลดหน้าใหม่"
            : "เกิดข้อผิดพลาดในการแสดงผลหน้านี้ หากโหลดซ้ำแล้วยังไม่สำเร็จ ให้กลับไปเริ่มจากหน้าหลัก"}
        </p>
        <p className="muted" role="status">
          รหัสข้อผิดพลาด: {this.state.kind === "asset" ? "ASSET_UPDATE" : "APP_RENDER"}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn primary" onClick={reloadFresh}>
            โหลดเวอร์ชันล่าสุด
          </button>
          <button className="btn outline" onClick={this.goHome}>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    ) : this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 },
  },
});
await initializeRecovery();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
