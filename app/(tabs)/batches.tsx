import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

type Batch = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
};

export default function BatchesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (error) console.warn(error.message);
          setBatches((data as any) ?? []);
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
      data={batches}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Ionicons name="school-outline" size={28} color={theme.textMuted} />
          <Text style={styles.emptyText}>No batches available right now.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: "/batch/[batchId]", params: { batchId: item.id } })}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="school" size={18} color={theme.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title ?? item.name}</Text>
            {item.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
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
  desc: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
  emptyCard: { alignItems: "center", padding: 30, gap: 8 },
  emptyText: { color: theme.textMuted, fontSize: 13 },
});
