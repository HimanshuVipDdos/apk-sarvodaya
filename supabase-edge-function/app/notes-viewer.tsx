import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

// Uses Google Docs' public viewer to render any PDF URL inline (works for
// Supabase Storage public URLs, Google Drive direct-download links, etc.)
// without needing a native PDF library.
export default function PdfViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();

  if (!url) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No file to show.</Text>
      </View>
    );
  }

  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

  return (
    <View style={styles.container}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : null}
      <WebView
        source={{ uri: viewerUrl }}
        style={{ flex: 1 }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator color="#17358a" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  errorText: { color: "#5b6280" },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  title: { fontSize: 14, fontWeight: "700", color: "#12183a" },
});
