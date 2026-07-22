import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { buildYouTubeEmbedHtml, describeYouTubeError } from "@/lib/youtube";

const ALLOWED_HOST_FRAGMENTS = ["youtube-nocookie.com", "youtube.com/embed", "ytimg.com", "googlevideo.com", "about:blank"];
function isAllowedNavigation(url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  return ALLOWED_HOST_FRAGMENTS.some((frag) => url.includes(frag));
}

export type YouTubePlayerHandle = { retry: () => void };

type Props = {
  videoId: string;
  isLive?: boolean;
  autoplay?: boolean;
  baseUrl?: string;
  onEnded?: () => void;
  onFullscreenToggle?: () => void;
};

// Thin wrapper around the custom-controlled YouTube WebView embed (see
// lib/youtube.ts for the actual HTML/CSS/JS that draws the play/pause, seek,
// quality and live-jump bar and hides YouTube's own UI). Shared by both the
// live-class screen and the recorded-lecture screen so fullscreen, retry and
// error handling behave identically everywhere a video plays in the app.
export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, isLive, autoplay = true, baseUrl = "https://sarvodayadhyeta.online", onEnded, onFullscreenToggle },
  ref
) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webviewKey, setWebviewKey] = useState(0);
  const autoRetryCount = useRef(0);
  const endedFired = useRef(false);
  const MAX_AUTO_RETRIES = 3;

  const retry = useCallback(() => {
    autoRetryCount.current = 0;
    endedFired.current = false;
    setError(null);
    setReady(false);
    setWebviewKey((k) => k + 1);
  }, []);

  useImperativeHandle(ref, () => ({ retry }), [retry]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === "ended" && !endedFired.current) {
          endedFired.current = true;
          onEnded?.();
        }
        if (msg.type === "ready") {
          setReady(true);
          autoRetryCount.current = 0;
        }
        if (msg.type === "fullscreentoggle") {
          onFullscreenToggle?.();
        }
        if (msg.type === "error") {
          if (autoRetryCount.current < MAX_AUTO_RETRIES) {
            autoRetryCount.current += 1;
            setTimeout(() => {
              setReady(false);
              setWebviewKey((k) => k + 1);
            }, 2500);
          } else {
            setError(describeYouTubeError(msg.data));
          }
        }
      } catch {
        // ignore malformed / non-JSON messages from the page
      }
    },
    [onEnded, onFullscreenToggle]
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        key={webviewKey}
        source={{ html: buildYouTubeEmbedHtml(videoId, { autoplay, isLive }), baseUrl }}
        onMessage={onMessage}
        onError={() => setError("Network error loading the video. Please check your internet connection.")}
        onHttpError={() => setError("Network error loading the video. Please check your internet connection.")}
        onShouldStartLoadWithRequest={(req: WebViewNavigation) => isAllowedNavigation(req.url)}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        style={{ flex: 1, backgroundColor: "#000" }}
      />
      {!ready && !error ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {error ? (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle-outline" size={26} color="#fff" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  errorText: { color: "#fff", fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 14 },
  retryBtn: { backgroundColor: theme.gold, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9 },
  retryBtnText: { color: theme.navyDark, fontWeight: "700", fontSize: 13 },
});
