import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  startCbtAttempt,
  submitCbtAttempt,
  type CbtQuestion,
  type SubmitAnswer,
} from "@/lib/cbt-api";

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

export default function TestTakingScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [questions, setQuestions] = useState<CbtQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deadlineRef = useRef<number | null>(null);

  // Load / resume the attempt
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await startCbtAttempt(testId);
        if (cancelled) return;
        setAttemptId(res.attempt_id);
        setTestTitle(res.test.title);
        setQuestions(res.questions);
        if (res.test.duration_minutes) {
          // Absolute deadline (not a countdown that drifts) — matches the
          // ref-based timer fix already used on the website.
          deadlineRef.current = Date.now() + res.test.duration_minutes * 60_000;
        }
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Could not load this test.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  // Timer tick, based on absolute deadline
  useEffect(() => {
    if (!deadlineRef.current) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadlineRef.current! - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleSubmit(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineRef.current, attemptId]);

  // Block hardware back button mid-test (prevents accidental exit)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Leave test?", "Your progress is saved, but the test won't be submitted.", [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, []);

  async function handleSubmit(auto = false) {
    if (!attemptId || submitting) return;
    if (!auto) {
      const unanswered = questions.length - Object.keys(answers).length;
      const confirmMsg =
        unanswered > 0
          ? `You have ${unanswered} unanswered question(s). Submit anyway?`
          : "Submit this test now?";
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert("Submit test", confirmMsg, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Submit", onPress: () => resolve(true) },
        ]);
      });
      if (!confirmed) return;
    }

    setSubmitting(true);
    const payload: SubmitAnswer[] = questions.map((q) => ({
      question_id: q.id,
      selected_option: answers[q.id] ?? null,
    }));

    try {
      await submitCbtAttempt(attemptId, payload);
      router.replace({ pathname: "/test/result/[attemptId]", params: { attemptId } });
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert("Submit failed", e.message ?? "Please try again.");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Can't start this test</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;
  const mins = secondsLeft != null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft != null ? secondsLeft % 60 : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.testTitle} numberOfLines={1}>
          {testTitle}
        </Text>
        {secondsLeft != null && (
          <View style={[styles.timerPill, secondsLeft < 60 && styles.timerPillUrgent]}>
            <Text style={styles.timerText}>
              ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.questionArea} contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.qCounter}>
          Question {current + 1} of {questions.length}
        </Text>
        <Text style={styles.qText}>{q.question_text}</Text>

        {OPTION_KEYS.map((key) => {
          const optionText = q[`option_${key}` as keyof CbtQuestion] as string;
          const selected = answers[q.id] === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
            >
              <View style={[styles.optionBullet, selected && styles.optionBulletSelected]}>
                <Text style={[styles.optionBulletText, selected && styles.optionBulletTextSelected]}>
                  {key.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.optionText}>{optionText}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Question palette */}
      <ScrollView horizontal style={styles.palette} showsHorizontalScrollIndicator={false}>
        {questions.map((qq, i) => {
          const isAnswered = !!answers[qq.id];
          const isCurrent = i === current;
          return (
            <TouchableOpacity
              key={qq.id}
              style={[
                styles.paletteItem,
                isAnswered && styles.paletteItemAnswered,
                isCurrent && styles.paletteItemCurrent,
              ]}
              onPress={() => setCurrent(i)}
            >
              <Text
                style={[
                  styles.paletteItemText,
                  (isAnswered || isCurrent) && styles.paletteItemTextActive,
                ]}
              >
                {i + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.progressText}>
          {answeredCount}/{questions.length} answered
        </Text>
        <View style={styles.navButtons}>
          <TouchableOpacity
            style={[styles.navButton, current === 0 && styles.navButtonDisabled]}
            disabled={current === 0}
            onPress={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            <Text style={styles.navButtonText}>Previous</Text>
          </TouchableOpacity>

          {current < questions.length - 1 ? (
            <TouchableOpacity
              style={styles.navButtonPrimary}
              onPress={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            >
              <Text style={styles.navButtonPrimaryText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              disabled={submitting}
              onPress={() => handleSubmit(false)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.navButtonPrimaryText}>Submit Test</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc", padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#dc2626" },
  errorMsg: { fontSize: 13, color: "#5b6280", marginTop: 8, textAlign: "center" },
  backLink: { marginTop: 20 },
  backLinkText: { color: "#17358a", fontWeight: "600" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  testTitle: { fontSize: 15, fontWeight: "700", color: "#12183a", flex: 1, marginRight: 10 },
  timerPill: { backgroundColor: "#f4e9c9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  timerPillUrgent: { backgroundColor: "#fee2e2" },
  timerText: { fontWeight: "700", color: "#17358a", fontSize: 13 },
  questionArea: { flex: 1 },
  qCounter: { fontSize: 12, color: "#9ba0bd", marginBottom: 8 },
  qText: { fontSize: 16, fontWeight: "600", color: "#12183a", marginBottom: 20, lineHeight: 22 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e6e9f5",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  optionSelected: { borderColor: "#17358a", backgroundColor: "#f4e9c9" },
  optionBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionBulletSelected: { backgroundColor: "#17358a", borderColor: "#17358a" },
  optionBulletText: { fontSize: 12, fontWeight: "700", color: "#5b6280" },
  optionBulletTextSelected: { color: "#fff" },
  optionText: { flex: 1, fontSize: 14, color: "#12183a" },
  palette: {
    maxHeight: 56,
    borderTopWidth: 1,
    borderTopColor: "#e6e9f5",
    backgroundColor: "#fff",
  },
  paletteItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    marginVertical: 10,
  },
  paletteItemAnswered: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  paletteItemCurrent: { borderColor: "#17358a", borderWidth: 2 },
  paletteItemText: { fontSize: 12, color: "#5b6280" },
  paletteItemTextActive: { color: "#12183a", fontWeight: "700" },
  footer: {
    padding: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e6e9f5",
  },
  progressText: { fontSize: 11, color: "#9ba0bd", marginBottom: 8, textAlign: "center" },
  navButtons: { flexDirection: "row", gap: 10 },
  navButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: { color: "#57534e", fontWeight: "600" },
  navButtonPrimary: {
    flex: 1,
    backgroundColor: "#17358a",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  navButtonPrimaryText: { color: "#fff", fontWeight: "700" },
  submitButton: {
    flex: 1,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
});
