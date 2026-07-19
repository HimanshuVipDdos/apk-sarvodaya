import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getCbtAttemptResult, type ResultResponse } from "@/lib/cbt-api";

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

export default function MistakesScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Text style={styles.errorText}>{error ?? "Not found."}</Text>
      </View>
    );
  }

  if (data.mistakes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.perfectEmoji}>🎉</Text>
        <Text style={styles.perfectText}>No mistakes! Perfect score.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 50 }}>
      <Text style={styles.heading}>Review Your Mistakes ({data.mistakes.length})</Text>

      {data.mistakes.map((m, idx) => (
        <View key={idx} style={styles.card}>
          <View style={styles.topicPill}>
            <Text style={styles.topicPillText}>{m.topic}</Text>
          </View>
          <Text style={styles.question}>{m.question_text}</Text>

          {OPTION_KEYS.map((key) => {
            const text = m[`option_${key}` as keyof typeof m] as string;
            const isCorrect = m.correct_option === key;
            const wasSelected = m.selected_option === key;
            return (
              <View
                key={key}
                style={[
                  styles.option,
                  isCorrect && styles.optionCorrect,
                  wasSelected && !isCorrect && styles.optionWrong,
                ]}
              >
                <Text style={styles.optionKey}>{key.toUpperCase()}.</Text>
                <Text style={styles.optionText}>{text}</Text>
                {isCorrect && <Text style={styles.tag}>✓ Correct</Text>}
                {wasSelected && !isCorrect && <Text style={styles.tagWrong}>✗ Your answer</Text>}
              </View>
            );
          })}
          {!m.selected_option && <Text style={styles.notAnswered}>You didn't answer this one.</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  errorText: { color: "#5b6280" },
  perfectEmoji: { fontSize: 40 },
  perfectText: { fontSize: 15, color: "#12183a", marginTop: 10, fontWeight: "600" },
  heading: { fontSize: 17, fontWeight: "700", color: "#12183a", marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  topicPill: {
    alignSelf: "flex-start",
    backgroundColor: "#f4e9c9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  topicPillText: { fontSize: 10, color: "#17358a", fontWeight: "700" },
  question: { fontSize: 14, fontWeight: "600", color: "#12183a", marginBottom: 12, lineHeight: 20 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e6e9f5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  optionCorrect: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  optionWrong: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  optionKey: { fontWeight: "700", color: "#5b6280", marginRight: 8 },
  optionText: { flex: 1, fontSize: 13, color: "#12183a" },
  tag: { fontSize: 10, color: "#16a34a", fontWeight: "700", marginLeft: 6 },
  tagWrong: { fontSize: 10, color: "#dc2626", fontWeight: "700", marginLeft: 6 },
  notAnswered: { fontSize: 12, color: "#9ba0bd", fontStyle: "italic", marginTop: 4 },
});
