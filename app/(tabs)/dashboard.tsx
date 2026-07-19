import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Animated,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { HeroSlider } from "@/components/HeroSlider";
import { RiseIn, PopIn, PressScale, usePulse, useFloat } from "@/components/Motion";

// Matches the real `batches` table schema (see app/(tabs)/batches.tsx note).
type Enrollment = {
  id: string;
  batch: {
    id: string;
    title?: string | null;
    thumbnail_url?: string | null;
    fees_inr?: number | null;
    exam_category?: string | null;
  } | null;
};

function formatInr(n?: number | null) {
  if (n == null) return null;
  return `₹${n.toLocaleString("en-IN")}`;
}

// Real, computable from the device clock — not fabricated data, just a
// friendlier hello than a static "Welcome back".
function greetingFor(hour: number) {
  if (hour < 5) return "Burning the midnight oil,";
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  if (hour < 21) return "Good evening,";
  return "Late night grind,";
}

const QUOTES = [
  "Consistency beats intensity. Show up today.",
  "Every question you attempt is a rank climbed.",
  "The exam doesn't test what you know once — it tests what you kept doing.",
  "Small daily progress adds up to big results.",
  "Discipline is choosing between what you want now and what you want most.",
];

export default function DashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const pulse = usePulse(loading);
  const blobFloat = useFloat(12, 3600);
  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);
  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [profileRes, enrollmentsRes] = await withTimeout(
        Promise.all([
          supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
          supabase
            .from("enrollments")
            .select("id, batch:batches(id, title, thumbnail_url, fees_inr, exam_category)")
            .eq("user_id", userId),
        ])
      );

      setFullName(profileRes.data?.full_name ?? "Student");
      setEnrollments((enrollmentsRes.data as any) ?? []);
    } catch (err) {
      console.warn("[dashboard] load failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.heroSkeletonWrap}>
          <ActivityIndicator color="#fff" />
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          <Animated.View style={[styles.skelBlock, { height: 90, opacity: pulse }]} />
          <Animated.View style={[styles.skelBlock, { height: 64, opacity: pulse }]} />
          <Animated.View style={[styles.skelBlock, { height: 64, opacity: pulse }]} />
        </View>
      </View>
    );
  }

  const firstName = (fullName || "Student").split(" ")[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.navy} />}
    >
      <View style={styles.heroCard}>
        <Animated.View style={[styles.heroBlobA, { transform: [{ translateY: blobFloat }] }]} />
        <Animated.View
          style={[styles.heroBlobB, { transform: [{ translateY: Animated.multiply(blobFloat, -1) }] }]}
        />

        <RiseIn delay={0}>
          <Text style={styles.greeting}>{greeting}</Text>
          <PopIn delay={80}>
            <Text style={styles.name}>{firstName} 👋</Text>
          </PopIn>
        </RiseIn>

        <RiseIn delay={140}>
          <View style={styles.statPill}>
            <Ionicons name="school" size={16} color={theme.gold} />
            <Text style={styles.statPillText}>
              {enrollments.length} {enrollments.length === 1 ? "Batch" : "Batches"} Enrolled
            </Text>
          </View>
        </RiseIn>

        <RiseIn delay={200}>
          <View style={styles.quoteRow}>
            <Ionicons name="sparkles" size={13} color={theme.goldLight} />
            <Text style={styles.quoteText} numberOfLines={2}>
              {quote}
            </Text>
          </View>
        </RiseIn>
      </View>

      {/* Homepage promo slider — same hero_slides content as the website */}
      <RiseIn delay={260} style={{ marginTop: 16 }}>
        <HeroSlider />
      </RiseIn>

      <RiseIn delay={320} style={{ paddingHorizontal: 20, marginTop: 22 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Batches</Text>
          {enrollments.length > 0 && (
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCountText}>{enrollments.length}</Text>
            </View>
          )}
        </View>

        {enrollments.length === 0 ? (
          <PressScale style={styles.emptyCard} onPress={() => router.push("/(tabs)/batches")}>
            <PopIn delay={0}>
              <Ionicons name="school-outline" size={30} color={theme.textMuted} />
            </PopIn>
            <Text style={styles.emptyText}>You haven't enrolled in any batch yet.</Text>
            <View style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>Browse Batches</Text>
              <Ionicons name="arrow-forward" size={14} color={theme.navy} />
            </View>
          </PressScale>
        ) : (
          enrollments.map((e, i) => (
            <RiseIn key={e.id} delay={360 + i * 60} distance={12}>
              <PressScale
                style={styles.batchCard}
                onPress={() =>
                  e.batch?.id &&
                  router.push({ pathname: "/batch/[batchId]", params: { batchId: e.batch.id } })
                }
              >
                {e.batch?.thumbnail_url ? (
                  <Image source={{ uri: e.batch.thumbnail_url }} style={styles.batchCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.batchCover, styles.batchCoverPlaceholder]}>
                    <Ionicons name="book" size={18} color={theme.navy} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  {e.batch?.exam_category ? (
                    <Text style={styles.batchCategory}>{e.batch.exam_category}</Text>
                  ) : null}
                  <Text style={styles.batchName} numberOfLines={1}>
                    {e.batch?.title ?? "Batch"}
                  </Text>
                  {e.batch?.fees_inr != null ? (
                    <Text style={styles.batchPrice}>{formatInr(e.batch.fees_inr)}</Text>
                  ) : null}
                </View>
                <View style={styles.chevronWrap}>
                  <Ionicons name="chevron-forward" size={16} color={theme.navy} />
                </View>
              </PressScale>
            </RiseIn>
          ))
        )}
      </RiseIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream },

  heroSkeletonWrap: {
    height: 190,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  skelBlock: { borderRadius: 16, backgroundColor: "#e6e9f5" },

  heroCard: {
    backgroundColor: theme.navy,
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  heroBlobA: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -50,
    right: -40,
  },
  heroBlobB: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(212,175,55,0.10)",
    bottom: -40,
    left: -30,
  },
  greeting: { fontSize: 13, color: "#c8d0ee" },
  name: { fontSize: 25, fontWeight: "800", color: "#fff", marginTop: 2, marginBottom: 14 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statPillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  quoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  quoteText: { flex: 1, fontSize: 12, color: "#e4e8fb", fontStyle: "italic", lineHeight: 17 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
  sectionCountBadge: {
    backgroundColor: theme.navy,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyText: { color: theme.textMuted, fontSize: 13, textAlign: "center" },
  emptyCta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  emptyCtaText: { color: theme.navy, fontSize: 13, fontWeight: "700" },

  batchCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  batchCover: { width: 52, height: 52, borderRadius: 10 },
  batchCoverPlaceholder: { backgroundColor: "#eef1fb", alignItems: "center", justifyContent: "center" },
  batchCategory: { fontSize: 9, fontWeight: "700", color: theme.navy, textTransform: "uppercase" },
  batchName: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginTop: 2 },
  batchPrice: { fontSize: 13, fontWeight: "700", color: theme.navy, marginTop: 3 },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eef1fb",
    alignItems: "center",
    justifyContent: "center",
  },
});
