import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Uses Google Docs' public viewer to render any PDF URL inline (works for
// Supabase Storage public URLs, Google Drive direct-download links, etc.)
// without needing a native PDF library. If that viewer itself fails to load
// (slow network, an unusual file type, Google's viewer being flaky for a
// particular file) we fall back to opening the raw file URL directly in the
// device browser/PDF app instead of leaving the student stuck on a blank
// or spinning screen.
export default function PdfViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  if (!url) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No file to show.</Text>
      </View>
    );
  }

  const openExternally = () => Linking.openURL(url);
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#12183a" />
        </TouchableOpacity>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <TouchableOpacity onPress={openExternally} hitSlop={10}>
          <Ionicons name="open-outline" size={20} color="#17358a" />
        </TouchableOpacity>
      </View>

      {failed ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={28} color="#9ba0bd" style={{ marginBottom: 10 }} />
          <Text style={styles.errorText}>Couldn't preview this file in-app.</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={openExternally}>
            <Text style={styles.retryButtonText}>Open in browser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          source={{ uri: viewerUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color="#17358a" />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc", padding: 24 },
  errorText: { color: "#5b6280", fontSize: 13, textAlign: "center", marginBottom: 14 },
  retryButton: { backgroundColor: "#17358a", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11 },
  retryButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  title: { flex: 1, fontSize: 14, fontWeight: "700", color: "#12183a" },
});
