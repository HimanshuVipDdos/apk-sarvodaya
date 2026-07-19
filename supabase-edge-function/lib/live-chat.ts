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

  useEffect(() => {
    let cancelled = false;

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
            const next = [...prev, incoming];
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
      const trimmed = text.trim();
      if (!trimmed) return;

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Please log in to comment.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = profile?.full_name || user.email?.split("@")[0] || "Student";

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      const isAdmin = (roleRows?.length ?? 0) > 0;

      const { error } = await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: user.id,
        user_name: name,
        message: trimmed.slice(0, 500),
        is_moderator: isAdmin,
      });
      if (error) throw new Error(error.message);
    },
    [liveClassId]
  );

  return { messages, loading, send };
}
