import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, Dimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { extractYouTubeId, buildYouTubeEmbedHtml } from "@/lib/youtube";

type LectureInfo = { id: string; title: string; youtube_url: string | null };

const { width: SCREEN_W } = Dimensions.get("window");
const PLAYER_HEIGHT = (SCREEN_W * 9) / 16;

const ALLOWED_HOST_FRAGMENTS = ["youtube-nocookie.com", "youtube.com/embed", "ytimg.com", "googlevideo.com", "about:blank"];
function isAllowedNavigation(url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  return ALLOWED_HOST_FRAGMENTS.some((frag) => url.includes(frag));
}

export default function LectureScreen() {
  const { lectureId } = useLocalSearchParams<{ lectureId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureInfo | null>(null);

  const load = useCallback(async () => {
    if (!lectureId) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("lectures")
      .select("id,title,youtube_url")
      .eq("id", lectureId)
      .maybeSingle();

    if (error) setErrorMsg(error.message);
    else if (!data) setErrorMsg("This lecture could not be found.");
    else setLecture(data as any);
    setLoading(false);
  }, [lectureId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  if (errorMsg || !lecture) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg ?? "Lecture not found."}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const videoId = extractYouTubeId(lecture.youtube_url);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {lecture.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {videoId ? (
        <View style={{ width: SCREEN_W, height: PLAYER_HEIGHT, backgroundColor: "#000" }}>
          <WebView
            source={{ html: buildYouTubeEmbedHtml(videoId), baseUrl: "https://www.youtube.com" }}
            onShouldStartLoadWithRequest={(req: WebViewNavigation) => isAllowedNavigation(req.url)}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <View style={[styles.center, { height: PLAYER_HEIGHT }]}>
          <Text style={styles.errorText}>Video link not available for this lecture.</Text>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: theme.cream }} />
    </View>
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
    paddingTop: Platform.OS === "ios" ? 50 : 14,
    paddingBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: "#000",
  },
  topBarTitle: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
});
