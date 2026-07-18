import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getCbtLeaderboard, type LeaderboardResponse } from "@/lib/cbt-api";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCbtLeaderboard(testId)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [testId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Leaderboard not available."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          🏆 {data.test_title}
        </Text>
        <Text style={styles.subtitle}>Top {data.entries.length} Rankers</Text>
      </View>

      <FlatList
        data={data.entries}
        keyExtractor={(item) => String(item.rank)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No submissions yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, item.is_me && styles.rowMe]}>
            <Text style={styles.rank}>{MEDALS[item.rank - 1] ?? `#${item.rank}`}</Text>
            <Text style={[styles.name, item.is_me && styles.nameMe]} numberOfLines={1}>
              {item.name} {item.is_me ? "(You)" : ""}
            </Text>
            <Text style={styles.score}>
              {item.score}/{item.max_score}
            </Text>
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
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#fff" },
  title: { fontSize: 17, fontWeight: "700", color: "#12183a" },
  subtitle: { fontSize: 12, color: "#9ba0bd", marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  rowMe: { borderColor: "#17358a", backgroundColor: "#f4e9c9" },
  rank: { width: 36, fontSize: 15, fontWeight: "700" },
  name: { flex: 1, fontSize: 14, color: "#12183a" },
  nameMe: { fontWeight: "700", color: "#17358a" },
  score: { fontSize: 13, fontWeight: "700", color: "#57534e" },
  emptyCard: { alignItems: "center", padding: 30 },
  emptyText: { color: "#9ba0bd", fontSize: 13 },
});
