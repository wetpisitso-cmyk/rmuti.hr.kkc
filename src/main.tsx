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
function reloadFresh() {
  const url = new URL(window.location.href);
  url.searchParams.set(FRESH_PARAM, String(Date.now()));
  window.location.replace(url.toString());
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
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    if (isStaleChunkError(error)) recoverChunkOnce();
  }
  render() {
    return this.state.failed ? (
      <div className="container section">
        <h1>ไม่สามารถแสดงหน้านี้ได้</h1>
        <p>หน้าเว็บอาจโหลดไม่ครบหลังมีการอัปเดต กรุณาเปิดเวอร์ชันล่าสุด</p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn primary" onClick={reloadFresh}>
            โหลดเวอร์ชันล่าสุด
          </button>
          <a className="btn outline" href={import.meta.env.BASE_URL}>
            กลับหน้าหลัก
          </a>
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
