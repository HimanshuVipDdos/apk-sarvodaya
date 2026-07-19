import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCbtAttemptResult, type ResultResponse } from "@/lib/cbt-api";
import { theme } from "@/lib/theme";

// ---------------------------------------------------------------------------
// A number that animates from 0 up to `value` once, using an Animated.Value
// driven listener. Cheap: one listener per number, no re-render storms.
// ---------------------------------------------------------------------------
function CountUpText({
  value,
  suffix = "",
  decimals = 0,
  style,
  delay = 0,
  duration = 700,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  style?: any;
  delay?: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState("0" + suffix);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => {
      setDisplay(`${v.toFixed(decimals)}${suffix}`);
    });
    Animated.timing(anim, {
      toValue: value,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // driving a JS listener, not a native prop
    }).start();
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

// A card that fades + rises into place. Pure transform/opacity => native
// driver => smooth even while the rest of the screen is still loading data.
function RiseIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Button with a tactile press-scale — replaces flat TouchableOpacity taps
// with something that feels alive without any extra dependency.
function PressScale({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// Animated horizontal fill bar (used for the score meter and topic rows).
function FillBar({
  percent,
  color,
  trackColor = "#e6e9f5",
  height = 8,
  delay = 0,
}: {
  percent: number;
  color: string;
  trackColor?: string;
  height?: number;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, percent, delay]);

  return (
    <View style={[styles.trackBase, { height, backgroundColor: trackColor, borderRadius: height }]}>
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        }}
      />
    </View>
  );
}

function gradeFor(percent: number): { label: string; color: string; emoji: string } {
  if (percent >= 90) return { label: "Outstanding", color: "#15803d", emoji: "🏆" };
  if (percent >= 75) return { label: "Excellent", color: "#16a34a", emoji: "🌟" };
  if (percent >= 60) return { label: "Good", color: theme.gold, emoji: "👍" };
  if (percent >= 40) return { label: "Needs work", color: "#d97706", emoji: "📘" };
  return { label: "Keep practicing", color: theme.dangerText, emoji: "💪" };
}

export default function ResultScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultResponse | null>(null);

  // Loading skeleton pulse
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    if (loading) loop.start();
    return () => loop.stop();
  }, [loading, pulse]);

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

  const percent = useMemo(() => {
    if (!data) return 0;
    const a = data.attempt;
    return a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
  }, [data]);

  const grade = useMemo(() => gradeFor(percent), [percent]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.heroSkeleton}>
          <ActivityIndicator color="#fff" />
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Animated.View key={i} style={[styles.skeletonBlock, { opacity: pulse }]} />
          ))}
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error ?? "Result not found."}</Text>
        <PressScale style={styles.retryBtn} onPress={() => router.replace("/(tabs)/dashboard")}>
          <Text style={styles.retryBtnText}>Back to Dashboard</Text>
        </PressScale>
      </View>
    );
  }

  const a = data.attempt;
  const isTop3 = data.rank <= 3;
  const medal = data.rank === 1 ? "🥇" : data.rank === 2 ? "🥈" : data.rank === 3 ? "🥉" : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroBlobA} />
        <View style={styles.heroBlobB} />

        <RiseIn delay={0} style={{ alignItems: "center" }}>
          <View style={[styles.gradeBadge, { backgroundColor: `${grade.color}22`, borderColor: grade.color }]}>
            <Text style={{ fontSize: 13 }}>{grade.emoji}</Text>
            <Text style={[styles.gradeBadgeText, { color: grade.color }]}>{grade.label}</Text>
          </View>

          <Text style={styles.testTitle} numberOfLines={2}>
            {a.test.title}
          </Text>

          <View style={styles.scoreCircleWrap}>
            <View style={styles.scoreCircleTrack} />
            <View style={styles.scoreCircle}>
              <CountUpText value={percent} suffix="%" style={styles.scorePercentText} duration={900} />
              <Text style={styles.scoreSubText}>score</Text>
            </View>
          </View>

          <View style={{ width: "78%", marginTop: 16 }}>
            <FillBar percent={percent} color={theme.goldLight} trackColor="rgba(255,255,255,0.18)" height={7} delay={250} />
          </View>

          <View style={styles.marksRow}>
            <CountUpText
              value={a.score}
              decimals={Number.isInteger(a.score) ? 0 : 1}
              style={styles.marksText}
              duration={800}
            />
            <Text style={styles.marksOfText}> / {a.max_score} marks</Text>
          </View>
        </RiseIn>
      </View>

      {/* Rank card */}
      <RiseIn delay={120} style={styles.rankCard}>
        <View style={styles.rankLeft}>
          <Text style={styles.rankMedal}>{medal ?? "📊"}</Text>
          <View>
            <Text style={styles.rankLabel}>Your Rank</Text>
            <Text style={[styles.rankValue, isTop3 && { color: theme.gold }]}>
              #{data.rank} <Text style={styles.rankOf}>of {data.total_participants}</Text>
            </Text>
          </View>
        </View>
        <PressScale
          style={styles.leaderboardChip}
          onPress={() => router.push({ pathname: "/leaderboard/[testId]", params: { testId: a.test_id } })}
        >
          <Text style={styles.leaderboardChipText}>Leaderboard →</Text>
        </PressScale>
      </RiseIn>

      {/* Stats grid */}
      <View style={styles.statsRow}>
        <RiseIn delay={180} style={{ flex: 1 }}>
          <StatCard label="Correct" value={a.correct_count} color="#16a34a" bg="#f0fdf4" icon="✅" />
        </RiseIn>
        <RiseIn delay={230} style={{ flex: 1 }}>
          <StatCard label="Wrong" value={a.wrong_count} color="#dc2626" bg="#fef2f2" icon="❌" />
        </RiseIn>
        <RiseIn delay={280} style={{ flex: 1 }}>
          <StatCard label="Skipped" value={a.unanswered_count} color="#5b6280" bg="#f4f5fa" icon="⬜" />
        </RiseIn>
      </View>

      {/* Topic breakdown */}
      {a.topic_breakdown && Object.keys(a.topic_breakdown).length > 0 && (
        <RiseIn delay={340} style={styles.topicCard}>
          <Text style={styles.topicHeading}>Topic-wise Analysis</Text>
          {Object.entries(a.topic_breakdown).map(([topic, stats], i) => {
            const total = stats.correct + stats.wrong + stats.unanswered;
            const acc = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
            return (
              <View key={topic} style={styles.topicRow}>
                <View style={styles.topicRowTop}>
                  <Text style={styles.topicName} numberOfLines={1}>
                    {topic}
                  </Text>
                  <Text style={styles.topicAcc}>{acc}%</Text>
                </View>
                <FillBar
                  percent={acc}
                  color={acc >= 60 ? "#16a34a" : acc >= 35 ? theme.gold : theme.dangerText}
                  delay={380 + i * 60}
                />
                <Text style={styles.topicMeta}>
                  ✅ {stats.correct}  ❌ {stats.wrong}  ⬜ {stats.unanswered}
                </Text>
              </View>
            );
          })}
        </RiseIn>
      )}

      {/* Actions */}
      <RiseIn delay={420} style={{ paddingHorizontal: 20, marginTop: 6 }}>
        <PressScale
          style={styles.mistakesButton}
          onPress={() => router.push({ pathname: "/test/mistakes/[attemptId]", params: { attemptId } })}
        >
          <Text style={styles.mistakesButtonText}>🔍  Review My Mistakes</Text>
        </PressScale>

        <PressScale style={styles.dashButton} onPress={() => router.replace("/(tabs)/dashboard")}>
          <Text style={styles.dashButtonText}>Back to Dashboard</Text>
        </PressScale>
      </RiseIn>
    </ScrollView>
  );
}

function StatCard({ label, value, color, bg, icon }: { label: string; value: number; color: string; bg: string; icon: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 15 }}>{icon}</Text>
      <CountUpText value={value} style={[styles.statValue, { color }]} duration={650} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream, padding: 30 },
  errorEmoji: { fontSize: 34, marginBottom: 10 },
  errorText: { color: theme.textSecondary, textAlign: "center", marginBottom: 18 },
  retryBtn: { backgroundColor: theme.navy, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700" },

  heroSkeleton: {
    height: 260,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonBlock: { height: 64, borderRadius: 16, backgroundColor: "#e6e9f5" },

  hero: {
    backgroundColor: theme.navy,
    paddingTop: 56,
    paddingBottom: 26,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  heroBlobA: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -60,
    right: -50,
  },
  heroBlobB: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(212,175,55,0.12)",
    bottom: -50,
    left: -40,
  },
  gradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  gradeBadgeText: { fontSize: 12, fontWeight: "700" },
  testTitle: { fontSize: 16, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 18, paddingHorizontal: 10 },

  scoreCircleWrap: { width: 140, height: 140, alignItems: "center", justifyContent: "center" },
  scoreCircleTrack: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    borderColor: "rgba(255,255,255,0.12)",
  },
  scoreCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.55)",
  },
  scorePercentText: { fontSize: 30, fontWeight: "800", color: "#fff" },
  scoreSubText: { fontSize: 11, color: "#c8d0ee", marginTop: 2 },

  marksRow: { flexDirection: "row", alignItems: "baseline", marginTop: 14 },
  marksText: { fontSize: 15, fontWeight: "800", color: theme.goldLight },
  marksOfText: { fontSize: 13, color: "#c8d0ee" },

  rankCard: {
    marginHorizontal: 20,
    marginTop: -22,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: "#12183a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  rankLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankMedal: { fontSize: 26 },
  rankLabel: { fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  rankValue: { fontSize: 17, fontWeight: "800", color: theme.textPrimary, marginTop: 2 },
  rankOf: { fontSize: 12, fontWeight: "500", color: theme.textSecondary },
  leaderboardChip: {
    backgroundColor: "#fdf6e3",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.goldLight,
  },
  leaderboardChipText: { fontSize: 11, fontWeight: "700", color: "#8a6d1a" },

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: "center", gap: 3 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: 0.3 },

  topicCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  topicHeading: { fontSize: 14, fontWeight: "700", color: theme.textPrimary, marginBottom: 14 },
  topicRow: { marginBottom: 14 },
  topicRowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  topicName: { fontSize: 12.5, fontWeight: "600", color: theme.textPrimary, flex: 1, marginRight: 8 },
  topicAcc: { fontSize: 12, fontWeight: "700", color: theme.textSecondary },
  topicMeta: { fontSize: 11, color: theme.textMuted, marginTop: 6 },
  trackBase: { width: "100%", overflow: "hidden" },

  mistakesButton: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: theme.navy,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  mistakesButtonText: { color: theme.navy, fontWeight: "700", fontSize: 14 },
  dashButton: {
    backgroundColor: theme.navy,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },
  dashButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
