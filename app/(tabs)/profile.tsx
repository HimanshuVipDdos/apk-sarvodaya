import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/is-admin";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";

type Profile = {
  full_name?: string | null;
  phone?: string | null;
  class_level?: string | null;
  exam_target?: string | null;
};

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const userId = session?.user?.id;
        if (!userId) {
          if (!cancelled) setLoading(false);
          return;
        }
        try {
          const { data } = await withTimeout(
            supabase.from("profiles").select("full_name, phone, class_level, exam_target").eq("id", userId).maybeSingle()
          );
          if (!cancelled) setProfile(data);
        } catch (err) {
          console.warn("[profile] load failed:", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [session?.user?.id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(profile?.full_name ?? "S")[0]?.toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{profile?.full_name ?? "Student"}</Text>
      <Text style={styles.email}>{session?.user?.email}</Text>

      <View style={styles.infoCard}>
        <InfoRow label="Phone" value={profile?.phone ?? "—"} />
        <InfoRow label="Class" value={profile?.class_level ?? "—"} />
        <InfoRow label="Exam Target" value={profile?.exam_target ?? "—"} />
      </View>

      {isAdmin && (
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push("/admin")}>
          <Ionicons name="shield-checkmark" size={18} color={theme.navy} />
          <Text style={styles.adminButtonText}>Admin Tools</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.navy} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream, alignItems: "center", padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: theme.textPrimary, marginTop: 12 },
  email: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  infoCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  infoLabel: { fontSize: 13, color: theme.textSecondary },
  infoValue: { fontSize: 13, color: theme.textPrimary, fontWeight: "500" },
  adminButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eef1fb",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  adminButtonText: { color: theme.navy, fontWeight: "700", fontSize: 14 },
  logoutButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
});
