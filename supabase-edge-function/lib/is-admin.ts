import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

// Mirrors the website's admin check (src/lib/cbt.functions.ts):
// supabase.rpc("has_role", { _user_id, _role: "admin" })
export function useIsAdmin() {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!cancelled) {
        if (error) console.warn("[has_role]", error.message);
        setIsAdmin(!!data);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return { isAdmin, checked };
}
