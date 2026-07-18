import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { theme } from "@/lib/theme";

type Enrollment = {
  id: string;
  batch: { id: string; title?: string | null; name?: string | null } | null;
};

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
      supabase.from("enrollments").select("id, batch:batches(*)").eq("user_id", userId),
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
              activeOpacity={0.8}
              onPress={() =>
                e.batch?.id &&
                router.push({ pathname: "/batch/[batchId]", params: { batchId: e.batch.id } })
              }
            >
              <View style={styles.batchIconWrap}>
                <Ionicons name="book" size={18} color={theme.navy} />
              </View>
              <Text style={styles.batchName}>{e.batch?.title ?? e.batch?.name ?? "Batch"}</Text>
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
    paddingBottom: 28,
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
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  batchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eef1fb",
    alignItems: "center",
    justifyContent: "center",
  },
  batchName: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, flex: 1 },
});
