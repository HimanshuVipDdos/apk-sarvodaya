import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/is-admin";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";
import { RiseIn, PressScale } from "@/components/Motion";

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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editExam, setEditExam] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (isManualRefresh = false) => {
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isManualRefresh) setRefreshing(true);
      try {
        const { data, error } = await withTimeout(
          supabase.from("profiles").select("full_name, phone, class_level, exam_target").eq("id", userId).maybeSingle()
        );
        if (error) throw error;
        setProfile(data);
        setLoadError(false);
      } catch (err) {
        console.warn("[profile] load failed:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
        hasLoadedOnce.current = true;
      }
    },
    [session?.user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) setLoading(true);
      load();
    }, [load])
  );

  function openEdit() {
    setEditName(profile?.full_name ?? "");
    setEditPhone(profile?.phone ?? "");
    setEditClass(profile?.class_level ?? "");
    setEditExam(profile?.exam_target ?? "");
    setEditVisible(true);
  }

  async function saveEdit() {
    const userId = session?.user?.id;
    if (!userId) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          phone: editPhone.trim() || null,
          class_level: editClass.trim() || null,
          exam_target: editExam.trim() || null,
        })
        .eq("id", userId);
      if (error) throw error;
      setProfile({
        full_name: trimmedName,
        phone: editPhone.trim() || null,
        class_level: editClass.trim() || null,
        exam_target: editExam.trim() || null,
      });
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    if (loggingOut) return;
    Alert.alert("Log out?", "You'll need to sign in again to access your batches.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ alignItems: "center", padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.navy} />}
      >
        {loadError && (
          <RiseIn style={{ width: "100%", marginBottom: 14 }}>
            <View style={styles.errorBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={theme.dangerText} />
              <Text style={styles.errorBannerText}>Couldn't refresh your profile. Pull down to retry.</Text>
            </View>
          </RiseIn>
        )}

        <RiseIn>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name ?? "S")[0]?.toUpperCase()}</Text>
          </View>
        </RiseIn>
        <RiseIn delay={60}>
          <Text style={styles.name}>{profile?.full_name ?? "Student"}</Text>
        </RiseIn>
        <RiseIn delay={90}>
          <Text style={styles.email}>{session?.user?.email}</Text>
        </RiseIn>

        <RiseIn delay={140} style={{ width: "100%" }}>
          <View style={styles.infoCard}>
            <InfoRow label="Phone" value={profile?.phone ?? "—"} />
            <InfoRow label="Class" value={profile?.class_level ?? "—"} />
            <InfoRow label="Exam Target" value={profile?.exam_target ?? "—"} last />
          </View>
        </RiseIn>

        <RiseIn delay={180} style={{ width: "100%" }}>
          <PressScale style={styles.editButton} onPress={openEdit}>
            <Ionicons name="create-outline" size={18} color={theme.navy} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </PressScale>
        </RiseIn>

        {isAdmin && (
          <RiseIn delay={220} style={{ width: "100%" }}>
            <TouchableOpacity style={styles.adminButton} onPress={() => router.push("/admin")}>
              <Ionicons name="shield-checkmark" size={18} color={theme.navy} />
              <Text style={styles.adminButtonText}>Admin Tools</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.navy} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          </RiseIn>
        )}

        <RiseIn delay={260}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color={theme.dangerText} size="small" /> : <Text style={styles.logoutText}>Log Out</Text>}
          </TouchableOpacity>
        </RiseIn>
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={theme.textMuted} />

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              maxLength={15}
            />

            <Text style={styles.fieldLabel}>Class</Text>
            <TextInput style={styles.input} value={editClass} onChangeText={setEditClass} placeholder="e.g. Class 12" placeholderTextColor={theme.textMuted} />

            <Text style={styles.fieldLabel}>Exam Target</Text>
            <TextInput style={styles.input} value={editExam} onChangeText={setEditExam} placeholder="e.g. UPSC, SSC CGL" placeholderTextColor={theme.textMuted} />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setEditVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <PressScale style={styles.modalSaveButton} onPress={saveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Save</Text>}
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.danger,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorBannerText: { flex: 1, fontSize: 12, color: theme.dangerText, fontWeight: "600" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    alignSelf: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: theme.textPrimary, marginTop: 12, textAlign: "center" },
  email: { fontSize: 13, color: theme.textSecondary, marginTop: 2, textAlign: "center" },
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
  editButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.navy,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  editButtonText: { color: theme.navy, fontWeight: "700", fontSize: 14 },
  adminButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eef1fb",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  adminButtonText: { color: theme.navy, fontWeight: "700", fontSize: 14 },
  logoutButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.dangerText,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 40,
    minWidth: 140,
    alignItems: "center",
  },
  logoutText: { color: theme.dangerText, fontWeight: "600" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(13,30,82,0.55)", justifyContent: "center", paddingHorizontal: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 22, maxHeight: "85%" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.textPrimary,
    backgroundColor: "#fff",
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: theme.cream,
  },
  modalCancelText: { color: theme.textSecondary, fontWeight: "700", fontSize: 13.5 },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: theme.gold,
  },
  modalSaveText: { color: theme.navyDark, fontWeight: "700", fontSize: 13.5 },
});
