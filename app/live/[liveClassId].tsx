import { useCallback, useEffect, useRef, useState } from "react";
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
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { useLiveChat } from "@/lib/live-chat";
import { extractYouTubeId, buildYouTubeEmbedHtml, describeYouTubeError } from "@/lib/youtube";

type LiveClassInfo = {
  id: string;
  title: string;
  is_live: boolean;
  youtube_url: string | null;
  batch_id: string;
};

const { width: SCREEN_W } = Dimensions.get("window");
const PLAYER_HEIGHT = (SCREEN_W * 9) / 16;

const ALLOWED_HOST_FRAGMENTS = ["youtube-nocookie.com", "youtube.com/embed", "ytimg.com", "googlevideo.com", "about:blank"];

function isAllowedNavigation(url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  return ALLOWED_HOST_FRAGMENTS.some((frag) => url.includes(frag));
}

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

  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [webviewKey, setWebviewKey] = useState(0);
  const autoRetryCount = useRef(0);
  const MAX_AUTO_RETRIES = 3;

  function retryVideo() {
    autoRetryCount.current = 0;
    setVideoError(null);
    setVideoReady(false);
    setWebviewKey((k) => k + 1);
  }

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

  function onWebViewMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ended") handleVideoEnded();
      if (msg.type === "ready") {
        setVideoReady(true);
        autoRetryCount.current = 0;
      }
      if (msg.type === "error") {
        if (autoRetryCount.current < MAX_AUTO_RETRIES) {
          autoRetryCount.current += 1;
          setTimeout(() => {
            setVideoReady(false);
            setWebviewKey((k) => k + 1);
          }, 2500);
        } else {
          setVideoError(describeYouTubeError(msg.data));
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  function onWebViewError() {
    setVideoError("Network error loading the video. Please check your internet connection.");
  }

  function onShouldStartLoad(request: WebViewNavigation) {
    return isAllowedNavigation(request.url);
  }

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
        {liveClass.is_live && !ended ? (
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>● LIVE</Text>
          </View>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {videoId ? (
        <View style={{ width: SCREEN_W, height: PLAYER_HEIGHT, backgroundColor: "#000" }}>
          <WebView
            key={webviewKey}
            source={{ html: buildYouTubeEmbedHtml(videoId, { autoplay: true }), baseUrl: "https://www.youtube.com" }}
            onMessage={onWebViewMessage}
            onError={onWebViewError}
            onHttpError={onWebViewError}
            onShouldStartLoadWithRequest={onShouldStartLoad}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            style={{ flex: 1 }}
          />
          {!videoReady && !videoError ? (
            <View style={styles.playerOverlay} pointerEvents="none">
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
          {videoError ? (
            <View style={styles.playerOverlay}>
              <Ionicons name="alert-circle-outline" size={26} color="#fff" style={{ marginBottom: 8 }} />
              <Text style={styles.videoErrorText}>{videoError}</Text>
              <TouchableOpacity style={styles.retryVideoBtn} onPress={retryVideo}>
                <Text style={styles.retryVideoBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.center, { height: PLAYER_HEIGHT }]}>
          <Text style={styles.errorText}>Video link not available for this class.</Text>
        </View>
      )}

      {ended ? (
        <View style={styles.endedBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={styles.endedBannerText}>Class ended — saved to Lectures</Text>
        </View>
      ) : null}

      <View style={styles.chatWrap}>
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
  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  videoErrorText: { color: "#fff", fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 14 },
  retryVideoBtn: { backgroundColor: theme.gold, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9 },
  retryVideoBtnText: { color: theme.navyDark, fontWeight: "700", fontSize: 13 },
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
});
