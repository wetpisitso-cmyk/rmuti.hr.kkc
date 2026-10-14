import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Profile, Role } from "../types/models";
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  role: Role;
  permissions: string[];
  can: (p: string) => boolean;
}>({
  session: null,
  loading: true,
  profile: null,
  role: "applicant",
  permissions: [],
  can: () => false,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      setReady(true);
      if (event === "SIGNED_OUT") qc.clear();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setReady(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [qc]);
  const q = useQuery({
    queryKey: ["identity", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session!.user.id)
          .single(),
        supabase
          .from("user_roles")
          .select("role,permissions")
          .eq("user_id", session!.user.id)
          .single(),
      ]);
      if (p.error || r.error) throw p.error || r.error;
      return {
        profile: p.data as Profile,
        role: r.data.role as Role,
        permissions: r.data.permissions as string[],
      };
    },
    retry: 1,
  });
  const role = q.data?.role || "applicant",
    permissions = q.data?.permissions || [];
  return (
    <Context.Provider
      value={{
        session,
        loading: !ready || (!!session && q.isPending),
        profile: q.data?.profile || null,
        role,
        permissions,
        can: (p) =>
          role === "admin" || (role === "hr" && permissions.includes(p)),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
