import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

// Matches the website's real `notifications` schema exactly
// (src/routes/_authenticated/admin.notifications.tsx): title, category,
// exam_date, link_url, body, is_active.
type Notice = {
  id: string;
  title: string;
  category: string;
  link_url: string | null;
  body: string | null;
  is_active: boolean;
  created_at: string;
};

const CATEGORIES = [
  { value: "vacancy", label: "Vacancy" },
  { value: "admit_card", label: "Admit Card" },
  { value: "answer_key", label: "Answer Key" },
  { value: "result", label: "Result" },
  { value: "exam_date", label: "Exam Date" },
  { value: "notification", label: "Notification" },
];

export default function AdminNoticesScreen() {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("vacancy");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.warn(error.message);
    setNotices((data as Notice[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function resetForm() {
    setTitle("");
    setCategory("vacancy");
    setBody("");
    setLinkUrl("");
  }

  async function handlePublish() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a title for the notice.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("notifications").insert({
      title: title.trim(),
      category,
      body: body.trim() || null,
      link_url: linkUrl.trim() || null,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Could not publish", error.message);
      return;
    }
    resetForm();
    setShowForm(false);
    load();
  }

  function confirmDelete(notice: Notice) {
    Alert.alert("Delete this notice?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("notifications").delete().eq("id", notice.id);
          if (error) Alert.alert("Delete failed", error.message);
          else load();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notices</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>New Notice</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.navy} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No notices yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryPill}>{item.category.replace("_", " ")}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardStatus}>{item.is_active ? "🟢 Live" : "⚪ Hidden"}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmDelete(item)}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>New Notice</Text>

            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={theme.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text style={[styles.categoryChipText, category === c.value && styles.categoryChipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="Details (optional)"
              placeholderTextColor={theme.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Link URL (optional)"
              placeholderTextColor={theme.textMuted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handlePublish} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Publish</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  header: {
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.navy,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  emptyText: { color: theme.textMuted, fontSize: 13, textAlign: "center", marginTop: 30 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryPill: { fontSize: 10, fontWeight: "700", color: theme.navy, textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginTop: 3 },
  cardStatus: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeading: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
    color: theme.textPrimary,
  },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  categoryChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  categoryChipActive: { backgroundColor: theme.navy, borderColor: theme.navy },
  categoryChipText: { fontSize: 12, color: theme.textSecondary, fontWeight: "600" },
  categoryChipTextActive: { color: "#fff" },
  modalButtonRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  cancelButtonText: { color: theme.textSecondary, fontWeight: "600" },
  saveButton: { flex: 1, backgroundColor: theme.navy, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "700" },
});
