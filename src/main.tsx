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
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="container section">
        <h1>ไม่สามารถแสดงหน้านี้ได้</h1>
        <p>กรุณาลองเปิดหน้าใหม่อีกครั้ง</p>
        <button
          className="btn primary"
          onClick={() => window.location.reload()}
        >
          โหลดใหม่
        </button>
      </div>
    ) : (
      this.props.children
    );
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
