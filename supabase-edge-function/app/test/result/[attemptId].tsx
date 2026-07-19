import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCbtAttemptResult, type ResultResponse } from "@/lib/cbt-api";

export default function ResultScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCbtAttemptResult(attemptId)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

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
        <Text style={styles.errorText}>{error ?? "Result not found."}</Text>
      </View>
    );
  }

  const a = data.attempt;
  const percent = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 50 }}>
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.testTitle}>{a.test.title}</Text>
      <Text style={styles.reportLabel}>Report Card</Text>

      <View style={styles.statsRow}>
        <Stat label="Score" value={`${a.score}/${a.max_score}`} />
        <Stat label="Percentage" value={`${percent}%`} />
        <Stat label="Rank" value={`#${data.rank}/${data.total_participants}`} />
      </View>

      <View style={styles.statsRow}>
        <Stat label="Correct" value={String(a.correct_count)} color="#16a34a" />
        <Stat label="Wrong" value={String(a.wrong_count)} color="#dc2626" />
        <Stat label="Unanswered" value={String(a.unanswered_count)} color="#5b6280" />
      </View>

      {a.topic_breakdown && Object.keys(a.topic_breakdown).length > 0 && (
        <View style={styles.topicCard}>
          <Text style={styles.topicHeading}>Topic-wise Analysis</Text>
          {Object.entries(a.topic_breakdown).map(([topic, stats]) => (
            <View key={topic} style={styles.topicRow}>
              <Text style={styles.topicName}>{topic}</Text>
              <Text style={styles.topicStats}>
                ✅ {stats.correct}  ❌ {stats.wrong}  ⬜ {stats.unanswered}
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.mistakesButton}
        onPress={() => router.push({ pathname: "/test/mistakes/[attemptId]", params: { attemptId } })}
      >
        <Text style={styles.mistakesButtonText}>🔍 Review My Mistakes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.leaderboardButton}
        onPress={() => router.push({ pathname: "/leaderboard/[testId]", params: { testId: a.test_id } })}
      >
        <Text style={styles.leaderboardButtonText}>🏆 View Leaderboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dashButton} onPress={() => router.replace("/(tabs)/dashboard")}>
        <Text style={styles.dashButtonText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  errorText: { color: "#5b6280" },
  trophy: { fontSize: 40, textAlign: "center" },
  testTitle: { fontSize: 20, fontWeight: "700", color: "#12183a", textAlign: "center", marginTop: 8 },
  reportLabel: { fontSize: 12, color: "#5b6280", textAlign: "center", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  statValue: { fontSize: 17, fontWeight: "700", color: "#12183a" },
  statLabel: { fontSize: 10, color: "#9ba0bd", marginTop: 4, textTransform: "uppercase" },
  topicCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  topicHeading: { fontSize: 14, fontWeight: "700", color: "#12183a", marginBottom: 10 },
  topicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  topicName: { fontSize: 13, color: "#12183a", flex: 1 },
  topicStats: { fontSize: 12, color: "#57534e" },
  mistakesButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#17358a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  mistakesButtonText: { color: "#17358a", fontWeight: "700" },
  leaderboardButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d97706",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  leaderboardButtonText: { color: "#d97706", fontWeight: "700" },
  dashButton: {
    backgroundColor: "#17358a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  dashButtonText: { color: "#fff", fontWeight: "700" },
});
