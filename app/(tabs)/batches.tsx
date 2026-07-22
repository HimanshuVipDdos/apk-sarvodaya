import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, Animated, RefreshControl, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { RiseIn, PressScale, usePulse } from "@/components/Motion";

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

function discountPercent(batch: Batch): number | null {
  const { fees_inr, original_fees_inr } = batch;
  if (!fees_inr || !original_fees_inr || original_fees_inr <= fees_inr) return null;
  return Math.round(((original_fees_inr - fees_inr) / original_fees_inr) * 100);
}

export default function BatchesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const hasLoadedOnce = useRef(false);
  const pulse = usePulse(loading);

  const load = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("batches")
          .select("id, title, description, thumbnail_url, exam_category, duration, fees_inr, original_fees_inr, is_featured")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("title", { ascending: true })
      );
      if (error) throw error;
      setBatches((data as any) ?? []);
      setLoadError(false);
    } catch (err) {
      console.warn("[batches] load failed:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) setLoading(true);
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 16, gap: 14 }}>
          <Animated.View style={[styles.skelBlock, { opacity: pulse }]} />
          <Animated.View style={[styles.skelBlock, { opacity: pulse }]} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={batches}
      keyExtractor={(item) => item.id}
      removeClippedSubviews
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.navy} />
      }
      ListHeaderComponent={
        loadError ? (
          <RiseIn style={{ marginBottom: 14 }}>
            <View style={styles.errorBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={theme.dangerText} />
              <Text style={styles.errorBannerText}>Couldn't refresh batches. Pull down to retry.</Text>
            </View>
          </RiseIn>
        ) : null
      }
      ListEmptyComponent={
        <RiseIn style={styles.emptyCard}>
          <Ionicons name="school-outline" size={28} color={theme.textMuted} />
          <Text style={styles.emptyText}>No batches available right now.</Text>
        </RiseIn>
      }
      renderItem={({ item, index }) => {
        const discount = discountPercent(item);
        return (
          <RiseIn delay={Math.min(index, 6) * 70} distance={14}>
            <PressScale style={styles.card} onPress={() => router.push({ pathname: "/batch/[batchId]", params: { batchId: item.id } })}>
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
                {discount != null ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{discount}% OFF</Text>
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
            </PressScale>
          </RiseIn>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  skelBlock: { height: 220, borderRadius: 16, backgroundColor: "#e6e9f5" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.danger,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorBannerText: { flex: 1, fontSize: 12, color: theme.dangerText, fontWeight: "600" },
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
  discountBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: theme.red,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  discountBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
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
