import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";

// Matches the real `notifications` table schema used by the website's admin
// panel (src/routes/_authenticated/admin.notifications.tsx): title,
// category, exam_date, link_url, body, is_active — NOT "message".
type Notice = {
  id: string;
  title: string;
  category?: string | null;
  exam_date?: string | null;
  link_url?: string | null;
  body?: string | null;
  created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  vacancy: "Vacancy",
  admit_card: "Admit Card",
  answer_key: "Answer Key",
  result: "Result",
  exam_date: "Exam Date",
  notification: "Notification",
};

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const { data, error } = await withTimeout(
            supabase.from("notifications").select("*").eq("is_active", true).order("created_at", { ascending: false })
          );
          if (cancelled) return;
          if (error) console.warn(error.message);
          setNotices((data as any) ?? []);
        } catch (err) {
          console.warn("[notifications] load failed:", err);
          if (!cancelled) setNotices([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      data={notices}
      keyExtractor={(item) => item.id}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No notices yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>
                {CATEGORY_LABELS[item.category] ?? item.category}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.message}>{item.body}</Text> : null}
          <View style={styles.footerRow}>
            <Text style={styles.date}>
              {new Date(item.exam_date ?? item.created_at).toLocaleDateString("en-IN")}
            </Text>
            {item.link_url ? (
              <TouchableOpacity onPress={() => Linking.openURL(item.link_url!)}>
                <Text style={styles.link}>Open link →</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "#f4e9c9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  categoryText: { fontSize: 10, color: theme.navy, fontWeight: "700" },
  title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
  message: { fontSize: 13, color: "#57534e", marginTop: 4 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  date: { fontSize: 11, color: theme.textMuted },
  link: { fontSize: 12, color: theme.navy, fontWeight: "700" },
  emptyCard: { alignItems: "center", padding: 30 },
  emptyText: { color: theme.textMuted, fontSize: 13 },
});
