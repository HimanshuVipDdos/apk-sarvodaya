import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, Animated, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { RiseIn, PressScale, usePulse } from "@/components/Motion";

type CbtTest = {
  id: string;
  title: string;
  duration_minutes?: number | null;
  marks_per_question?: number | null;
};

export default function TestsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [tests, setTests] = useState<CbtTest[]>([]);
  const hasLoadedOnce = useRef(false);
  const pulse = usePulse(loading);

  const load = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("cbt_tests")
          .select("id, title, duration_minutes, marks_per_question")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      setTests((data as any) ?? []);
      setLoadError(false);
    } catch (err) {
      console.warn("[tests] load failed:", err);
      // Don't wipe out a previously-successful list on a transient error —
      // just surface a retry banner instead of a misleading "no tests" state.
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
        <View style={{ padding: 20, gap: 10 }}>
          <Animated.View style={[styles.skelBlock, { opacity: pulse }]} />
          <Animated.View style={[styles.skelBlock, { opacity: pulse }]} />
          <Animated.View style={[styles.skelBlock, { opacity: pulse }]} />
          <Animated.View style={[styles.skelBlock, { opacity: pulse }]} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 20, flexGrow: 1 }}
      data={tests}
      keyExtractor={(item) => item.id}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.navy} />
      }
      ListHeaderComponent={
        loadError ? (
          <RiseIn style={{ marginBottom: 14 }}>
            <View style={styles.errorBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={theme.dangerText} />
              <Text style={styles.errorBannerText}>Couldn't refresh tests. Pull down to retry.</Text>
            </View>
          </RiseIn>
        ) : null
      }
      ListEmptyComponent={
        <RiseIn style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={28} color={theme.textMuted} />
          <Text style={styles.emptyText}>No tests available right now.</Text>
        </RiseIn>
      }
      renderItem={({ item, index }) => (
        <RiseIn delay={Math.min(index, 6) * 60} distance={12}>
          <PressScale
            style={styles.card}
            onPress={() => router.push({ pathname: "/test/[testId]", params: { testId: item.id } })}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="document-text" size={18} color={theme.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.metaRow}>
                {item.duration_minutes ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                    <Text style={styles.meta}>{item.duration_minutes} min</Text>
                  </View>
                ) : null}
                {item.marks_per_question ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="bar-chart-outline" size={12} color={theme.textSecondary} />
                    <Text style={styles.meta}>{item.marks_per_question} marks/question</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color={theme.navy} />
            </View>
          </PressScale>
        </RiseIn>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  skelBlock: { height: 74, borderRadius: 14, backgroundColor: "#e6e9f5" },
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
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
