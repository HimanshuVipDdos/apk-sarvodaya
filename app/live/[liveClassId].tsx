import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { useLiveChat } from "@/lib/live-chat";
import { extractYouTubeId } from "@/lib/youtube";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";

type LiveClassInfo = {
  id: string;
  title: string;
  is_live: boolean;
  youtube_url: string | null;
  batch_id: string;
};

const { width: SCREEN_W } = Dimensions.get("window");
const PLAYER_HEIGHT = (SCREEN_W * 9) / 16;

export default function LiveClassScreen() {
  const { liveClassId } = useLocalSearchParams<{ liveClassId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveClass, setLiveClass] = useState<LiveClassInfo | null>(null);
  const [ended, setEnded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const savedRef = useRef(false);
  const listRef = useRef<FlatList>(null);
  const hasLoadedOnce = useRef(false);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  // Fullscreen: rotates to landscape and gives the video the whole screen.
  // showChatInFullscreen: while fullscreen, tapping the chat bubble shrinks
  // the video to the left (like YouTube's landscape split) and shows chat
  // on the right, instead of leaving the app and hiding the video entirely.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChatInFullscreen, setShowChatInFullscreen] = useState(false);

  const { messages, loading: chatLoading, send } = useLiveChat(liveClassId ?? "");

  const load = useCallback(async () => {
    if (!liveClassId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("live_classes")
          .select("id,title,is_live,youtube_url,batch_id")
          .eq("id", liveClassId)
          .maybeSingle()
      );

      if (error) {
        console.warn("[live] load failed:", error.message);
        if (!liveClass) setErrorMsg(error.message);
      } else if (!data) {
        if (!liveClass) setErrorMsg("This class could not be found.");
      } else {
        setLiveClass(data as any);
        setErrorMsg(null);
      }
    } catch (err: any) {
      console.warn("[live] load failed:", err);
      if (!liveClass) setErrorMsg(err?.message ?? "Couldn't load this class.");
    }
    setLoading(false);
    hasLoadedOnce.current = true;
  }, [liveClassId, liveClass]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Always leave fullscreen + relock portrait when this screen loses focus
  // or unmounts, so the rest of the app never gets stuck in landscape.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsFullscreen(false);
        setShowChatInFullscreen(false);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, [])
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      } else {
        setShowChatInFullscreen(false);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      return next;
    });
  }, []);

  const handleVideoEnded = useCallback(async () => {
    if (savedRef.current || !liveClass) return;
    savedRef.current = true;
    setEnded(true);

    try {
      await supabase.from("live_classes").update({ is_live: false }).eq("id", liveClass.id);

      const { data: existing } = await supabase
        .from("lectures")
        .select("id")
        .eq("source_live_class_id", liveClass.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("lectures").insert({
          batch_id: liveClass.batch_id,
          title: liveClass.title,
          youtube_url: liveClass.youtube_url,
          is_published: true,
          source_live_class_id: liveClass.id,
        });
      }
    } catch (err) {
      console.warn("[live] auto-save to lectures failed:", err);
    }
  }, [liveClass]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  if (errorMsg || !liveClass) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg ?? "Class not found."}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const videoId = extractYouTubeId(liveClass.youtube_url);
  const isLive = liveClass.is_live && !ended;

  const chatPanel = (
    <View style={[styles.chatWrap, isFullscreen && styles.chatWrapFullscreen]}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        removeClippedSubviews
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          chatLoading ? null : <Text style={styles.chatEmpty}>No messages yet — say hi 👋</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.chatRow}>
            <Text style={[styles.chatName, item.is_moderator && styles.chatNameMod]}>
              {item.user_name ?? "Student"}
              {item.is_moderator ? " • Admin" : ""}
            </Text>
            <Text style={styles.chatMsg}>{item.message}</Text>
          </View>
        )}
      />
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          placeholder="Type a message…"
          placeholderTextColor={theme.textMuted}
          value={chatInput}
          onChangeText={setChatInput}
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && { opacity: 0.6 }]}
          disabled={sending || !chatInput.trim()}
          onPress={async () => {
            if (!chatInput.trim() || sending) return;
            const text = chatInput;
            setChatInput("");
            setSending(true);
            try {
              await send(text);
            } catch (err: any) {
              setChatInput(text);
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );

  const videoBox = videoId ? (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <YouTubePlayer
        ref={playerRef}
        videoId={videoId}
        isLive={isLive}
        autoplay
        onEnded={handleVideoEnded}
        onFullscreenToggle={toggleFullscreen}
      />
    </View>
  ) : (
    <View style={[styles.center, { flex: 1 }]}>
      <Text style={styles.errorText}>Video link not available for this class.</Text>
    </View>
  );

  if (isFullscreen) {
    return (
      <View style={styles.fullscreenRoot}>
        <StatusBar hidden />
        <View style={{ flex: showChatInFullscreen ? 0.62 : 1 }}>{videoBox}</View>
        {showChatInFullscreen ? chatPanel : null}

        {/* Floating controls over the video — separate from the in-video
            control bar so chat can be toggled without the WebView needing
            to know anything about chat. */}
        <TouchableOpacity
          style={[styles.fsFloatingBtn, { left: insets.left + 10, top: insets.top + 8 }]}
          onPress={toggleFullscreen}
          hitSlop={10}
        >
          <Ionicons name="contract" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fsFloatingBtn, { right: insets.right + 10, top: insets.top + 8 }]}
          onPress={() => setShowChatInFullscreen((v) => !v)}
          hitSlop={10}
        >
          <Ionicons name={showChatInFullscreen ? "chatbubble" : "chatbubble-outline"} size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {liveClass.title}
        </Text>
        {isLive ? (
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>● LIVE</Text>
          </View>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <View style={{ width: SCREEN_W, height: PLAYER_HEIGHT, backgroundColor: "#000" }}>{videoBox}</View>

      {ended ? (
        <View style={styles.endedBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={styles.endedBannerText}>Class ended — saved to Lectures</Text>
        </View>
      ) : null}

      {chatPanel}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000", padding: 24 },
  errorText: { color: "#fff", fontSize: 13, textAlign: "center", marginBottom: 14 },
  backBtn: { backgroundColor: theme.navy, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: "#000",
  },
  topBarTitle: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  liveTag: { backgroundColor: "#dc2626", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  liveTagText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  endedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f2913",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  endedBannerText: { color: "#86efac", fontSize: 12, fontWeight: "600" },
  chatWrap: { flex: 1, backgroundColor: theme.cream },
  chatWrapFullscreen: { flex: 0.38, borderLeftWidth: 1, borderLeftColor: "#000" },
  chatEmpty: { color: theme.textMuted, fontSize: 13, textAlign: "center", marginTop: 20 },
  chatRow: { backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.border },
  chatName: { fontSize: 11, fontWeight: "700", color: theme.navy, marginBottom: 2 },
  chatNameMod: { color: theme.red },
  chatMsg: { fontSize: 13, color: theme.textPrimary },
  chatInputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: "#fff",
  },
  chatInput: {
    flex: 1,
    backgroundColor: theme.cream,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.textPrimary,
  },
  sendBtn: { backgroundColor: theme.navy, borderRadius: 20, width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  fullscreenRoot: { flex: 1, flexDirection: "row", backgroundColor: "#000" },
  fsFloatingBtn: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
