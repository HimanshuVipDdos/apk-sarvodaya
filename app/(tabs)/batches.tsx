import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

// Matches the real `batches` table schema used on the website
// (src/routes/batches.tsx): title, thumbnail_url, fees_inr,
// original_fees_inr, exam_category, duration, subjects, is_featured.
type Batch = {
  id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  exam_category?: string | null;
  duration?: string | null;
  fees_inr?: number | null;
  original_fees_inr?: number | null;
  is_featured?: boolean | null;
};

function formatInr(n?: number | null) {
  if (n == null) return null;
  return `₹${n.toLocaleString("en-IN")}`;
}

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
          .select("id, title, description, thumbnail_url, exam_category, duration, fees_inr, original_fees_inr, is_featured")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("title", { ascending: true });
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
      contentContainerStyle={{ padding: 16 }}
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
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: "/batch/[batchId]", params: { batchId: item.id } })}
        >
          <View style={styles.coverWrap}>
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Ionicons name="school" size={28} color={theme.navy} />
              </View>
            )}
            {item.is_featured ? (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>Featured</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.info}>
            {item.exam_category ? <Text style={styles.category}>{item.exam_category}</Text> : null}
            <Text style={styles.title}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            <View style={styles.footerRow}>
              <View>
                {item.duration ? <Text style={styles.duration}>{item.duration}</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={styles.price}>{formatInr(item.fees_inr) ?? "—"}</Text>
                  {item.original_fees_inr && item.fees_inr && item.original_fees_inr > item.fees_inr ? (
                    <Text style={styles.originalPrice}>{formatInr(item.original_fees_inr)}</Text>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward-circle" size={26} color={theme.navy} />
            </View>
          </View>
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
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  coverWrap: { position: "relative" },
  cover: { width: "100%", aspectRatio: 16 / 9 },
  coverPlaceholder: { backgroundColor: "#eef1fb", alignItems: "center", justifyContent: "center" },
  featuredBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", color: theme.navy },
  info: { padding: 14 },
  category: { fontSize: 10, fontWeight: "700", color: theme.navy, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginTop: 3 },
  desc: { fontSize: 12, color: theme.textSecondary, marginTop: 4, lineHeight: 17 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 },
  duration: { fontSize: 11, color: theme.textMuted, marginBottom: 2 },
  price: { fontSize: 19, fontWeight: "700", color: theme.navy },
  originalPrice: { fontSize: 12, color: theme.textMuted, textDecorationLine: "line-through" },
  emptyCard: { alignItems: "center", padding: 30, gap: 8 },
  emptyText: { color: theme.textMuted, fontSize: 13 },
});
