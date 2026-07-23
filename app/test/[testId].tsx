import { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  startCbtAttempt,
  submitCbtAttempt,
  type CbtQuestion,
  type SubmitAnswer,
} from "@/lib/cbt-api";
import { theme } from "@/lib/theme";
import { FillBar, PressScale } from "@/components/Motion";

const OPTION_KEYS = ["a", "b", "c", "d"] as const;
const PALETTE_ITEM_SPAN = 44; // item width (36) + horizontal margin (4+4)

// Ticks every second entirely on its own — the parent screen (question text,
// options, the palette of every question number) never re-renders because of
// the clock, only this small pill does. On a long test with 100+ questions
// this is the difference between smooth scrolling and visible jank every
// single second.
const TimerPill = memo(function TimerPill({
  deadline,
  onExpire,
}: {
  deadline: number;
  onExpire: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((deadline - Date.now()) / 1000)));
  const expiredRef = useRef(false);
  const urgent = secondsLeft < 60;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    expiredRef.current = false;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  // Gentle urgency pulse in the last minute only — purely visual, never
  // touches the actual countdown logic above.
  useEffect(() => {
    if (!urgent) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [urgent, pulse]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <Animated.View style={[styles.timerPill, urgent && styles.timerPillUrgent, { transform: [{ scale: pulse }] }]}>
      <Text style={styles.timerText}>
        ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </Text>
    </Animated.View>
  );
});

// One palette button, memoized: with 100 questions on screen, selecting an
// answer or moving `current` should only re-paint the 1-2 buttons whose
// state actually changed, not all 100.
const PaletteItem = memo(function PaletteItem({
  index,
  isAnswered,
  isCurrent,
  onPress,
}: {
  index: number;
  isAnswered: boolean;
  isCurrent: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.paletteItem, isAnswered && styles.paletteItemAnswered, isCurrent && styles.paletteItemCurrent]}
      onPress={onPress}
    >
      <Text style={[styles.paletteItemText, (isAnswered || isCurrent) && styles.paletteItemTextActive]}>{index + 1}</Text>
    </TouchableOpacity>
  );
});

export default function TestTakingScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [questions, setQuestions] = useState<CbtQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Mirrors `answers` so the timer's auto-submit (fired from inside a
  // setInterval closure) always reads the LATEST answers, not the empty
  // object captured when the interval was first created.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
    if (attemptId) {
      AsyncStorage.setItem(`cbt_answers_${attemptId}`, JSON.stringify(answers)).catch(() => {});
    }
  }, [answers, attemptId]);
  // Keeps TimerPill's onExpire prop referentially stable across re-renders
  // (e.g. every time an answer is picked) so its internal interval doesn't
  // get torn down and recreated for no reason.
  const handleSubmitRef = useRef<(auto?: boolean) => void>(() => {});
  const onTimerExpire = useRef(() => handleSubmitRef.current(true)).current;

  // Question transition fade — purely cosmetic, resets on every `current` change.
  const questionFade = useRef(new Animated.Value(0)).current;
  const questionArea = useRef<ScrollView>(null);
  const paletteScroll = useRef<ScrollView>(null);

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
        // Restore any answers saved locally before a previous crash / kill /
        // dropped connection — the server only has answers we've already
        // submitted, so this local copy is the only record of in-progress
        // selections between submits.
        try {
          const cached = await AsyncStorage.getItem(`cbt_answers_${res.attempt_id}`);
          if (cached) setAnswers(JSON.parse(cached));
        } catch {
          // Corrupt/unreadable cache — safe to ignore, just start blank.
        }
        if (res.test.duration_minutes) {
          // Absolute deadline (not a countdown that drifts) — matches the
          // ref-based timer fix already used on the website.
          setDeadline(Date.now() + res.test.duration_minutes * 60_000);
        }
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        // Already submitted this test before — don't dead-end on an error,
        // take the student straight to their existing result/analysis.
        if (e?.code === "already_submitted" && e?.attemptId) {
          router.replace({ pathname: "/test/result/[attemptId]", params: { attemptId: e.attemptId } });
          return;
        }
        setError(e.message ?? "Could not load this test.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

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

  // Every time the visible question changes: scroll the question area back
  // to the top (previously it kept whatever scroll offset the last question
  // was left at — a long question could leave the next one starting
  // mid-scroll), nudge the palette so `current` stays in view on long
  // tests, and play a small fade-in for the new question.
  useEffect(() => {
    questionArea.current?.scrollTo({ y: 0, animated: false });
    const targetX = Math.max(0, current * PALETTE_ITEM_SPAN - 140);
    paletteScroll.current?.scrollTo({ x: targetX, animated: true });
    questionFade.setValue(0);
    Animated.timing(questionFade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [current]);

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
    const latestAnswers = answersRef.current;
    const payload: SubmitAnswer[] = questions.map((q) => ({
      question_id: q.id,
      selected_option: latestAnswers[q.id] ?? null,
    }));

    try {
      await submitCbtAttempt(attemptId, payload);
      AsyncStorage.removeItem(`cbt_answers_${attemptId}`).catch(() => {});
      router.replace({ pathname: "/test/result/[attemptId]", params: { attemptId } });
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert("Submit failed", e.message ?? "Please try again.");
    }
  }
  handleSubmitRef.current = handleSubmit;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.testTitle} numberOfLines={1}>
          {testTitle}
        </Text>
        {deadline != null && <TimerPill deadline={deadline} onExpire={onTimerExpire} />}
      </View>

      <ScrollView ref={questionArea} style={styles.questionArea} contentContainerStyle={{ padding: 20 }}>
        <Animated.View style={{ opacity: questionFade }}>
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
                activeOpacity={0.75}
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
        </Animated.View>
      </ScrollView>

      {/* Question palette */}
      <ScrollView ref={paletteScroll} horizontal style={styles.palette} showsHorizontalScrollIndicator={false}>
        {questions.map((qq, i) => (
          <PaletteItem
            key={qq.id}
            index={i}
            isAnswered={!!answers[qq.id]}
            isCurrent={i === current}
            onPress={() => setCurrent(i)}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {answeredCount}/{questions.length} answered
          </Text>
          <FillBar
            percent={questions.length ? (answeredCount / questions.length) * 100 : 0}
            color={theme.gold}
            height={5}
          />
        </View>
        <View style={styles.navButtons}>
          <TouchableOpacity
            style={[styles.navButton, current === 0 && styles.navButtonDisabled]}
            disabled={current === 0}
            onPress={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            <Text style={styles.navButtonText}>Previous</Text>
          </TouchableOpacity>

          {current < questions.length - 1 ? (
            <PressScale style={styles.navButtonPrimary} onPress={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
              <Text style={styles.navButtonPrimaryText}>Next</Text>
            </PressScale>
          ) : (
            <PressScale style={styles.submitButton} disabled={submitting} onPress={() => handleSubmit(false)}>
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.navButtonPrimaryText}>Submit Test</Text>
              )}
            </PressScale>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream, padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: theme.dangerText },
  errorMsg: { fontSize: 13, color: theme.textSecondary, marginTop: 8, textAlign: "center" },
  backLink: { marginTop: 20 },
  backLinkText: { color: theme.navy, fontWeight: "600" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  testTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary, flex: 1, marginRight: 10 },
  timerPill: { backgroundColor: "#f4e9c9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  timerPillUrgent: { backgroundColor: theme.danger },
  timerText: { fontWeight: "700", color: theme.navy, fontSize: 13 },
  questionArea: { flex: 1 },
  qCounter: { fontSize: 12, color: theme.textMuted, marginBottom: 8 },
  qText: { fontSize: 16, fontWeight: "600", color: theme.textPrimary, marginBottom: 20, lineHeight: 22 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  optionSelected: { borderColor: theme.navy, backgroundColor: "#f4e9c9" },
  optionBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionBulletSelected: { backgroundColor: theme.navy, borderColor: theme.navy },
  optionBulletText: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
  optionBulletTextSelected: { color: "#fff" },
  optionText: { flex: 1, fontSize: 14, color: theme.textPrimary },
  palette: {
    maxHeight: 56,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: "#fff",
  },
  paletteItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    marginVertical: 10,
  },
  paletteItemAnswered: { backgroundColor: theme.success, borderColor: theme.successBorder },
  paletteItemCurrent: { borderColor: theme.navy, borderWidth: 2 },
  paletteItemText: { fontSize: 12, color: theme.textSecondary },
  paletteItemTextActive: { color: theme.textPrimary, fontWeight: "700" },
  footer: {
    padding: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  progressRow: { marginBottom: 10, gap: 6 },
  progressText: { fontSize: 11, color: theme.textMuted, textAlign: "center" },
  navButtons: { flexDirection: "row", gap: 10 },
  navButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: { color: theme.textSecondary, fontWeight: "600" },
  navButtonPrimary: {
    flex: 1,
    backgroundColor: theme.navy,
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
