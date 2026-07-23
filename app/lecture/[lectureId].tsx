import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { extractYouTubeId } from "@/lib/youtube";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";

type LectureInfo = { id: string; title: string; video_url: string | null };

const { width: SCREEN_W } = Dimensions.get("window");
const PLAYER_HEIGHT = (SCREEN_W * 9) / 16;

export default function LectureScreen() {
  const { lectureId } = useLocalSearchParams<{ lectureId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureInfo | null>(null);
  const hasLoadedOnce = useRef(false);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const load = useCallback(async () => {
    if (!lectureId) return;
    // First load only shows the spinner. Every later call — which happens
    // on every focus regain, e.g. the student switches apps and comes back —
    // must not flip `loading` back to true. Doing so would swap out this
    // whole screen including the WebView, restarting the video from 0 on
    // every single app foreground.
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.from("lectures").select("id,title,video_url").eq("id", lectureId).maybeSingle()
      );

      if (error) {
        console.warn("[lecture] load failed:", error.message);
        // Never blow away an already-playing lecture over a background refresh hiccup.
        if (!lecture) setErrorMsg(error.message);
      } else if (!data) {
        if (!lecture) setErrorMsg("This lecture could not be found.");
      } else {
        setLecture(data as any);
        setErrorMsg(null);
      }
    } catch (err: any) {
      // withTimeout rejects if the request hangs — without this, a slow or
      // dropped connection would leave the spinner running forever.
      console.warn("[lecture] load failed:", err);
      if (!lecture) setErrorMsg(err?.message ?? "Couldn't load this lecture.");
    }
    setLoading(false);
    hasLoadedOnce.current = true;
  }, [lectureId, lecture]);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lectureId])
  );

  // Always leave fullscreen + relock portrait when this screen loses focus
  // or unmounts, so the rest of the app never gets stuck in landscape.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsFullscreen(false);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, [])
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      ScreenOrientation.lockAsync(
        next ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
      ).catch(() => {});
      return next;
    });
  }, []);

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

  const videoId = extractYouTubeId(lecture.video_url);

  const videoBox = videoId ? (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <YouTubePlayer ref={playerRef} videoId={videoId} autoplay onFullscreenToggle={toggleFullscreen} />
    </View>
  ) : (
    <View style={[styles.center, { flex: 1 }]}>
      <Text style={styles.errorText}>Video link not available for this lecture.</Text>
    </View>
  );

  if (isFullscreen) {
    return (
      <View style={styles.fullscreenRoot}>
        <StatusBar hidden />
        {videoBox}
        <TouchableOpacity
          style={[styles.fsFloatingBtn, { left: insets.left + 10, top: insets.top + 8 }]}
          onPress={toggleFullscreen}
          hitSlop={10}
        >
          <Ionicons name="contract" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Full black background here — status bar icons need to be light,
          regardless of the app-wide "dark" default set in the root layout. */}
      <StatusBar style="light" />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {lecture.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ width: SCREEN_W, height: PLAYER_HEIGHT, backgroundColor: "#000" }}>{videoBox}</View>

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
    paddingBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: "#000",
  },
  topBarTitle: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  fullscreenRoot: { flex: 1, backgroundColor: "#000" },
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
