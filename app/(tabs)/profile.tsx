import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  full_name?: string | null;
  phone?: string | null;
  class_level?: string | null;
  exam_target?: string | null;
};

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const userId = session?.user?.id;
        if (!userId) return;
        const { data } = await supabase
          .from("profiles")
          .select("full_name, phone, class_level, exam_target")
          .eq("id", userId)
          .maybeSingle();
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
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
        <ActivityIndicator color="#17358a" />
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
  container: { flex: 1, backgroundColor: "#f7f8fc", alignItems: "center", padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#17358a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: "#12183a", marginTop: 12 },
  email: { fontSize: 13, color: "#5b6280", marginTop: 2 },
  infoCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9f5",
  },
  infoLabel: { fontSize: 13, color: "#5b6280" },
  infoValue: { fontSize: 13, color: "#12183a", fontWeight: "500" },
  logoutButton: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
});
