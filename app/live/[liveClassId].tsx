import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useLiveChat } from "@/lib/live-chat";
import { useAuth } from "@/lib/auth-context";

type LiveClass = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  is_live: boolean;
};

// Turns a normal YouTube link (watch?v=..., youtu.be/..., or an unlisted
// link) into an embeddable player URL.
function toEmbedUrl(youtubeUrl: string): string | null {
  try {
    const url = new URL(youtubeUrl);
    let videoId = url.searchParams.get("v");
    if (!videoId && url.hostname.includes("youtu.be")) {
      videoId = url.pathname.replace("/", "");
    }
    if (!videoId && url.pathname.includes("/embed/")) {
      videoId = url.pathname.split("/embed/")[1];
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0`;
  } catch {
    return null;
  }
}

const { width } = Dimensions.get("window");
const VIDEO_HEIGHT = (width * 9) / 16;

export default function LiveClassScreen() {
  const { liveClassId } = useLocalSearchParams<{ liveClassId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const { messages, loading: chatLoading, send } = useLiveChat(liveClassId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("live_classes")
        .select("id,title,description,youtube_url,is_live")
        .eq("id", liveClassId)
        .maybeSingle();
      if (!cancelled) {
        setLiveClass(data as LiveClass);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveClassId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await send(text);
      setText("");
    } catch (e) {
      // Silently ignore — a small inline error state could be added later.
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }

  if (!liveClass) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Class not found.</Text>
      </View>
    );
  }

  const embedUrl = liveClass.youtube_url ? toEmbedUrl(liveClass.youtube_url) : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={styles.videoWrap}>
        {embedUrl ? (
          <WebView
            source={{ uri: embedUrl }}
            style={{ height: VIDEO_HEIGHT, backgroundColor: "#000" }}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
          />
        ) : (
          <View style={[styles.center, { height: VIDEO_HEIGHT, backgroundColor: "#000" }]}>
            <Text style={{ color: "#fff" }}>Video not available yet.</Text>
          </View>
        )}
        {liveClass.is_live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.infoBar}>
        <Text style={styles.title} numberOfLines={2}>
          {liveClass.title}
        </Text>
      </View>

      {/* Live comments — same live_chat_messages table + Realtime as the website */}
      <View style={styles.chatSection}>
        <View style={styles.chatHeader}>
          <View style={styles.liveDotSmall} />
          <Text style={styles.chatHeaderText}>LIVE COMMENTS</Text>
          <Text style={styles.chatCount}>{messages.length}</Text>
        </View>

        {chatLoading ? (
          <ActivityIndicator color="#17358a" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 10 }}
            ListEmptyComponent={
              <Text style={styles.emptyChat}>No comments yet. Say hi 👋</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.messageRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.user_name ?? "S").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{item.user_name ?? "Student"}</Text>
                    {item.is_moderator && (
                      <View style={styles.teacherBadge}>
                        <Text style={styles.teacherBadgeText}>TEACHER</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
              </View>
            )}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a comment…"
            placeholderTextColor="#9ba0bd"
            value={text}
            onChangeText={setText}
            maxLength={500}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#5b6280" },
  videoWrap: { position: "relative" },
  liveBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220,38,38,0.9)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  infoBar: {
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  title: { fontSize: 14, fontWeight: "700", color: "#12183a" },
  chatSection: { flex: 1, backgroundColor: "#fff" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#dc2626" },
  chatHeaderText: { fontSize: 11, fontWeight: "700", color: "#57534e", letterSpacing: 0.5 },
  chatCount: { fontSize: 11, color: "#9ba0bd", marginLeft: "auto" },
  emptyChat: { fontSize: 12, color: "#9ba0bd", textAlign: "center", marginTop: 20 },
  messageRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#17358a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 12, fontWeight: "700", color: "#12183a" },
  teacherBadge: { backgroundColor: "#17358a", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  teacherBadgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  messageText: { fontSize: 13, color: "#3a4066", marginTop: 2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#e6e9f5",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    backgroundColor: "#fafaf9",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#17358a",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: "#fff", fontSize: 14 },
});
