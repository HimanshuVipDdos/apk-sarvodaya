import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCbtAttemptResult, type ResultResponse } from "@/lib/cbt-api";
import { theme } from "@/lib/theme";
import { RiseIn, PressScale } from "@/components/Motion";

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

export default function MistakesScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    let cancelled = false;
    getCbtAttemptResult(attemptId)
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
  }, [attemptId]);

  // Quick breakdown of *why* points were lost — wrong guesses need different
  // revision than questions that were simply skipped, so surfacing the split
  // up front tells the student which habit to fix.
  const breakdown = useMemo(() => {
    if (!data) return { wrong: 0, unanswered: 0 };
    let wrong = 0;
    let unanswered = 0;
    for (const m of data.mistakes) {
      if (!m.selected_option) unanswered += 1;
      else wrong += 1;
    }
    return { wrong, unanswered };
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
        <Text style={styles.errorText}>{error ?? "Not found."}</Text>
        <PressScale style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </PressScale>
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24 }}>
      <RiseIn>
        <Text style={styles.heading}>Review Your Mistakes ({data.mistakes.length})</Text>
        <View style={styles.breakdownRow}>
          <View style={[styles.breakdownPill, styles.breakdownPillWrong]}>
            <Text style={styles.breakdownPillText}>✗ {breakdown.wrong} wrong</Text>
          </View>
          <View style={[styles.breakdownPill, styles.breakdownPillSkip]}>
            <Text style={[styles.breakdownPillText, { color: theme.textSecondary }]}>⬜ {breakdown.unanswered} skipped</Text>
          </View>
        </View>
      </RiseIn>

      {data.mistakes.map((m, idx) => (
        <RiseIn key={idx} delay={Math.min(idx, 8) * 60} distance={12}>
          <View style={styles.card}>
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
        </RiseIn>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream, gap: 14, padding: 24 },
  errorText: { color: theme.textSecondary },
  retryBtn: { backgroundColor: theme.navy, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  perfectEmoji: { fontSize: 40 },
  perfectText: { fontSize: 15, color: theme.textPrimary, marginTop: 10, fontWeight: "600" },
  heading: { fontSize: 17, fontWeight: "700", color: theme.textPrimary, marginBottom: 10 },
  breakdownRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  breakdownPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  breakdownPillWrong: { backgroundColor: "#fef2f2" },
  breakdownPillSkip: { backgroundColor: "#f4f5fa" },
  breakdownPillText: { fontSize: 11.5, fontWeight: "700", color: theme.dangerText },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  topicPill: {
    alignSelf: "flex-start",
    backgroundColor: "#f4e9c9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  topicPillText: { fontSize: 10, color: theme.navy, fontWeight: "700" },
  question: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 12, lineHeight: 20 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  optionCorrect: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  optionWrong: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  optionKey: { fontWeight: "700", color: theme.textSecondary, marginRight: 8 },
  optionText: { flex: 1, fontSize: 13, color: theme.textPrimary },
  tag: { fontSize: 10, color: "#16a34a", fontWeight: "700", marginLeft: 6 },
  tagWrong: { fontSize: 10, color: theme.dangerText, fontWeight: "700", marginLeft: 6 },
  notAnswered: { fontSize: 12, color: theme.textMuted, fontStyle: "italic", marginTop: 4 },
});
