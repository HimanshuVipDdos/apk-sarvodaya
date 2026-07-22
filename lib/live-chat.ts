// Same `live_chat_messages` table + Supabase Realtime as the website's
// LiveChat component — direct client calls work here (no edge function
// needed) because RLS already allows any authenticated user to read chat and
// insert their own messages.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type ChatMessage = {
  id: string;
  live_class_id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  created_at: string;
  is_moderator: boolean;
};

const MAX_RENDERED = 300;

export function useLiveChat(liveClassId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const identityRef = useRef<{ userId: string; name: string; isAdmin: boolean } | null>(null);
  const identityPromiseRef = useRef<Promise<{ userId: string; name: string; isAdmin: boolean }> | null>(null);

  const loadIdentity = useCallback(async () => {
    if (identityRef.current) return identityRef.current;
    if (!identityPromiseRef.current) {
      identityPromiseRef.current = (async () => {
        const { data: userData } = await supabase.auth.getSession();
        const user = userData.session?.user;
        if (!user) throw new Error("Please log in to comment.");

        const [{ data: profile }, { data: roleRows }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
        ]);

        const identity = {
          userId: user.id,
          name: profile?.full_name || user.email?.split("@")[0] || "Student",
          isAdmin: (roleRows?.length ?? 0) > 0,
        };
        identityRef.current = identity;
        return identity;
      })();
    }
    return identityPromiseRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadIdentity().catch(() => {});

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("live_class_id", liveClassId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) {
        setMessages((data as ChatMessage[]) ?? []);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`live-chat-${liveClassId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => {
            const tempIdx = prev.findIndex(
              (m) => m.id.startsWith("temp-") && m.user_id === incoming.user_id && m.message === incoming.message
            );
            let next: ChatMessage[];
            if (tempIdx !== -1) {
              next = [...prev];
              next[tempIdx] = incoming;
            } else {
              if (prev.some((m) => m.id === incoming.id)) return prev;
              next = [...prev, incoming];
            }
            return next.length > MAX_RENDERED ? next.slice(next.length - MAX_RENDERED) : next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const deletedId = (payload.old as ChatMessage).id;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveClassId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed) return;

      const identity = await loadIdentity();
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        live_class_id: liveClassId,
        user_id: identity.userId,
        user_name: identity.name,
        message: trimmed,
        created_at: new Date().toISOString(),
        is_moderator: identity.isAdmin,
      };
      setMessages((prev) => [...prev, optimistic]);

      const { error } = await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: identity.userId,
        user_name: identity.name,
        message: trimmed,
        is_moderator: identity.isAdmin,
      });

      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw new Error(error.message);
      }
    },
    [liveClassId, loadIdentity]
  );

  return { messages, loading, send };
}
