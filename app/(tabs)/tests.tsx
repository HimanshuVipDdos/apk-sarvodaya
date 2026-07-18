import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

type CbtTest = {
  id: string;
  title: string;
  duration_minutes?: number | null;
  total_marks?: number | null;
};

export default function TestsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<CbtTest[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from("cbt_tests")
          .select("id, title, duration_minutes, total_marks")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (error) console.warn(error.message);
          setTests((data as any) ?? []);
          setLoading(false);
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
      data={tests}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={28} color={theme.textMuted} />
          <Text style={styles.emptyText}>No tests available right now.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: "/test/[testId]", params: { testId: item.id } })}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="document-text" size={18} color={theme.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.metaRow}>
              {item.duration_minutes ? (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                  <Text style={styles.meta}>{item.duration_minutes} min</Text>
                </View>
              ) : null}
              {item.total_marks ? (
                <View style={styles.metaItem}>
                  <Ionicons name="bar-chart-outline" size={12} color={theme.textSecondary} />
                  <Text style={styles.meta}>{item.total_marks} marks</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </TouchableOpacity>
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
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eef1fb",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },
  metaRow: { flexDirection: "row", gap: 14, marginTop: 5 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 11, color: theme.textSecondary },
  emptyCard: { alignItems: "center", padding: 30, gap: 8 },
  emptyText: { color: theme.textMuted, fontSize: 13 },
});
