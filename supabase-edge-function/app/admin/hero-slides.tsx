import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

// Matches the website's hero_slides table exactly (src/routes/_authenticated/admin.hero-slides.tsx)
// and uploads to the same "hero-slides" Supabase Storage bucket, so slides
// added here appear on the website too, and vice versa.
type Slide = {
  id: string;
  title: string | null;
  image_url: string;
  link_type: string;
  link_value: string | null;
  sort_order: number;
  is_active: boolean;
};

export default function AdminHeroSlidesScreen() {
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string; ext: string } | null>(null);
  const [title, setTitle] = useState("");
  const [linkType, setLinkType] = useState<"none" | "whatsapp" | "url">("none");
  const [linkValue, setLinkValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hero_slides")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) console.warn(error.message);
    setSlides((data as Slide[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function resetForm() {
    setPickedImage(null);
    setTitle("");
    setLinkType("none");
    setLinkValue("");
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to upload a slide image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
    setPickedImage({ uri: asset.uri, base64: asset.base64 ?? "", ext });
  }

  async function handleAdd() {
    if (!pickedImage) {
      Alert.alert("Photo required", "Please pick a slide image first.");
      return;
    }
    setUploading(true);
    try {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${pickedImage.ext}`;
      const arrayBuffer = decodeBase64(pickedImage.base64);
      const { error: upErr } = await supabase.storage.from("hero-slides").upload(path, arrayBuffer, {
        contentType: `image/${pickedImage.ext === "jpg" ? "jpeg" : pickedImage.ext}`,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("hero-slides").getPublicUrl(path);

      const nextSort = slides.length > 0 ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;

      setSaving(true);
      const { error: insErr } = await supabase.from("hero_slides").insert({
        image_url: pub.publicUrl,
        title: title.trim() || null,
        link_type: linkType,
        link_value: linkType === "none" ? null : linkValue.trim() || null,
        sort_order: nextSort,
        is_active: true,
      });
      if (insErr) throw insErr;

      resetForm();
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again.");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  async function toggleActive(slide: Slide) {
    setSlides((prev) => prev.map((s) => (s.id === slide.id ? { ...s, is_active: !s.is_active } : s)));
    const { error } = await supabase.from("hero_slides").update({ is_active: !slide.is_active }).eq("id", slide.id);
    if (error) {
      Alert.alert("Could not update", error.message);
      load();
    }
  }

  function confirmDelete(slide: Slide) {
    Alert.alert("Delete this slide?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("hero_slides").delete().eq("id", slide.id);
          if (error) Alert.alert("Delete failed", error.message);
          else load();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Homepage Slider</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add Slide</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.navy} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={slides}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No slides yet. Tap "Add Slide" to create one.</Text>}
          renderItem={({ item }) => (
            <View style={styles.slideCard}>
              <Image source={{ uri: item.image_url }} style={styles.slideThumb} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.slideTitle}>{item.title || "Untitled"}</Text>
                <Text style={styles.slideMeta}>
                  {item.link_type === "none" ? "No link" : `${item.link_type}: ${item.link_value ?? "—"}`}
                </Text>
              </View>
              <Switch value={item.is_active} onValueChange={() => toggleActive(item)} trackColor={{ true: theme.navy }} />
              <TouchableOpacity onPress={() => confirmDelete(item)} style={{ marginLeft: 6 }}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>New Slide</Text>

            <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
              {pickedImage ? (
                <Image source={{ uri: pickedImage.uri }} style={styles.pickPreview} resizeMode="cover" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={22} color={theme.navy} />
                  <Text style={styles.pickButtonText}>Choose photo</Text>
                </>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Label (optional, admin only)"
              placeholderTextColor={theme.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <View style={styles.linkTypeRow}>
              {(["none", "whatsapp", "url"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.linkTypeChip, linkType === t && styles.linkTypeChipActive]}
                  onPress={() => setLinkType(t)}
                >
                  <Text style={[styles.linkTypeChipText, linkType === t && styles.linkTypeChipTextActive]}>
                    {t === "none" ? "No link" : t === "whatsapp" ? "WhatsApp" : "URL"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {linkType !== "none" && (
              <TextInput
                style={styles.input}
                placeholder={linkType === "whatsapp" ? "919876543210" : "https://example.com"}
                placeholderTextColor={theme.textMuted}
                value={linkValue}
                onChangeText={setLinkValue}
                autoCapitalize="none"
              />
            )}

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
              <TouchableOpacity style={styles.saveButton} onPress={handleAdd} disabled={uploading || saving}>
                {uploading || saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Publish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Converts a base64 string (from expo-image-picker) into a Uint8Array,
// which Supabase Storage's upload() accepts directly in React Native
// (no Blob/FileReader available there).
function decodeBase64(base64: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  slideCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  slideThumb: { width: 60, height: 34, borderRadius: 8, backgroundColor: "#eef1fb" },
  slideTitle: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
  slideMeta: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeading: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 16 },
  pickButton: {
    height: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#f7f8fc",
  },
  pickButtonText: { fontSize: 12, color: theme.navy, fontWeight: "600" },
  pickPreview: { width: "100%", height: "100%" },
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
  linkTypeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  linkTypeChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  linkTypeChipActive: { backgroundColor: theme.navy, borderColor: theme.navy },
  linkTypeChipText: { fontSize: 12, color: theme.textSecondary, fontWeight: "600" },
  linkTypeChipTextActive: { color: "#fff" },
  modalButtonRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  cancelButtonText: { color: theme.textSecondary, fontWeight: "600" },
  saveButton: { flex: 1, backgroundColor: theme.navy, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "700" },
});
