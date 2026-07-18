import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { theme } from "@/lib/theme";
import { HeroSlider } from "@/components/HeroSlider";

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

export default function DashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;

    const [profileRes, enrollmentsRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase
        .from("enrollments")
        .select("id, batch:batches(id, title, thumbnail_url, fees_inr, exam_category)")
        .eq("user_id", userId),
    ]);

    setFullName(profileRes.data?.full_name ?? "Student");
    setEnrollments((enrollmentsRes.data as any) ?? []);
    setLoading(false);
    setRefreshing(false);
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
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.navy} />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{fullName}</Text>
        <View style={styles.statPill}>
          <Ionicons name="school" size={16} color={theme.gold} />
          <Text style={styles.statPillText}>{enrollments.length} Purchased Batches</Text>
        </View>
      </View>

      {/* Homepage promo slider — same hero_slides content as the website */}
      <View style={{ marginTop: 16 }}>
        <HeroSlider />
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Text style={styles.sectionTitle}>Your Batches</Text>
        {enrollments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="school-outline" size={28} color={theme.textMuted} />
            <Text style={styles.emptyText}>You haven't enrolled in any batch yet.</Text>
          </View>
        ) : (
          enrollments.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={styles.batchCard}
              activeOpacity={0.85}
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
                <Text style={styles.batchName}>{e.batch?.title ?? "Batch"}</Text>
                {e.batch?.fees_inr != null ? (
                  <Text style={styles.batchPrice}>{formatInr(e.batch.fees_inr)}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream },
  heroCard: {
    backgroundColor: theme.navy,
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: { fontSize: 13, color: "#c8d0ee" },
  name: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 2, marginBottom: 14 },
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
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10, color: theme.textPrimary },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyText: { color: theme.textMuted, fontSize: 13 },
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
});
