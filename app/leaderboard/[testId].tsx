import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCbtLeaderboard, type LeaderboardResponse, type LeaderboardEntry } from "@/lib/cbt-api";
import { theme } from "@/lib/theme";
import { RiseIn, PressScale } from "@/components/Motion";

const MEDALS = ["🥇", "🥈", "🥉"];
const ROW_HEIGHT = 62; // fixed row height incl. marginBottom — needed for getItemLayout below

export default function LeaderboardScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);

  function load() {
    setLoading(true);
    setError(null);
    let cancelled = false;
    getCbtLeaderboard(testId)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    return load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // Auto-scroll to the student's own row once the list has rendered — on a
  // test with a long leaderboard, nobody wants to hunt for "am I rank 40-something?"
  // by scrolling manually every time they open this screen.
  useEffect(() => {
    if (!data) return;
    const myIndex = data.entries.findIndex((e) => e.is_me);
    if (myIndex <= 2) return; // already visible at the top, no need to scroll
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: myIndex, animated: true, viewPosition: 0.35 });
    }, 350);
    return () => clearTimeout(timer);
  }, [data]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Leaderboard not available."}</Text>
        <PressScale style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </PressScale>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.title} numberOfLines={1}>
          🏆 {data.test_title}
        </Text>
        <Text style={styles.subtitle}>Top {data.entries.length} Rankers</Text>
      </View>

      <FlatList
        ref={listRef}
        data={data.entries}
        keyExtractor={(item) => String(item.rank)}
        contentContainerStyle={{ padding: 16 }}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        onScrollToIndexFailed={(info) => {
          // Fallback if the estimated offset was off (variable content, slow layout) —
          // retry the scroll shortly after the list has settled instead of silently failing.
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.35 });
          }, 200);
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No submissions yet.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isTop3 = item.rank <= 3;
          return (
            <RiseIn delay={Math.min(index, 10) * 40} distance={10}>
              <View style={[styles.row, isTop3 && styles.rowTop3, item.is_me && styles.rowMe]}>
                <Text style={styles.rank}>{MEDALS[item.rank - 1] ?? `#${item.rank}`}</Text>
                <Text style={[styles.name, item.is_me && styles.nameMe]} numberOfLines={1}>
                  {item.name} {item.is_me ? "(You)" : ""}
                </Text>
                <Text style={styles.score}>
                  {item.score}/{item.max_score}
                </Text>
              </View>
            </RiseIn>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream, padding: 24, gap: 14 },
  errorText: { color: theme.textSecondary, textAlign: "center" },
  retryBtn: { backgroundColor: theme.navy, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  header: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#fff" },
  title: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  subtitle: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    height: ROW_HEIGHT - 8,
  },
  rowTop3: { backgroundColor: "#fdf6e3", borderColor: theme.goldLight },
  rowMe: { borderColor: theme.navy, backgroundColor: "#f4e9c9", borderWidth: 1.5 },
  rank: { width: 36, fontSize: 15, fontWeight: "700" },
  name: { flex: 1, fontSize: 14, color: theme.textPrimary },
  nameMe: { fontWeight: "700", color: theme.navy },
  score: { fontSize: 13, fontWeight: "700", color: theme.textSecondary },
  emptyCard: { alignItems: "center", padding: 30 },
  emptyText: { color: theme.textMuted, fontSize: 13 },
});
