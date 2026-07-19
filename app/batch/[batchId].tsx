import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Image, Animated } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

type LiveClass = { id: string; title: string; is_live: boolean; scheduled_at: string; youtube_url: string | null };
type Lecture = { id: string; title: string; lecture_number: number | null; youtube_url: string | null };
type CbtTest = { id: string; title: string; duration_minutes: number | null };
type Material = { id: string; title: string; file_url: string | null; material_type: string | null };
type BatchInfo = {
  title: string;
  thumbnail_url: string | null;
  fees_inr: number | null;
  original_fees_inr: number | null;
  exam_category: string | null;
  duration: string | null;
};

function formatInr(n?: number | null) {
  if (n == null) return null;
  return `₹${n.toLocaleString("en-IN")}`;
}

const TABS = ["Live", "Lectures", "Tests", "Notes"] as const;
type Tab = (typeof TABS)[number];

export default function BatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Live");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [tests, setTests] = useState<CbtTest[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(
    async (cancelledRef: { current: boolean }) => {
      setLoading(true);
      setErrorMsg(null);
      fadeAnim.setValue(0);

      // Best-effort: flips is_live flags server-side. Fire-and-forget so a slow/hanging
      // RPC can never block the actual page data from loading.
      supabase.rpc("tick_live_classes").catch(() => {
        // non-critical — ignore silently
      });

      try {
        // Safety net: if any request hangs (bad network, cold Supabase function, etc.)
        // this guarantees the loading state resolves to an error instead of spinning forever.
        const withTimeout = <T,>(p: Promise<T>, ms = 15000): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Request timed out. Please check your connection and try again.")), ms)),
          ]);

        const [batchRes, liveRes, lecRes, testRes, matRes] = await withTimeout(
          Promise.all([
            supabase.from("batches").select("title, thumbnail_url, fees_inr, original_fees_inr, exam_category, duration").eq("id", batchId).maybeSingle(),
            supabase.from("live_classes").select("id,title,is_live,scheduled_at,youtube_url").eq("batch_id", batchId).order("scheduled_at", { ascending: false }),
            supabase.from("lectures").select("id,title,lecture_number,youtube_url").eq("batch_id", batchId).eq("is_published", true).order("lecture_number", { ascending: true }),
            supabase.from("cbt_tests").select("id,title,duration_minutes").eq("batch_id", batchId).eq("is_published", true),
            supabase.from("study_materials").select("id,title,file_url,material_type").eq("batch_id", batchId).order("created_at", { ascending: false }),
          ])
        );

        if (cancelledRef.current) return;

        if (batchRes.error) throw batchRes.error;

        setBatchInfo((batchRes.data as any) ?? null);
        setLiveClasses((liveRes.data as any) ?? []);
        setLectures((lecRes.data as any) ?? []);
        setTests((testRes.data as any) ?? []);
        setMaterials((matRes.data as any) ?? []);
        setLoading(false);

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }).start();
      } catch (err: any) {
        if (cancelledRef.current) return;
        console.warn("Failed to load batch:", err);
        setErrorMsg(err?.message ?? "Couldn't load this batch. Check your connection and try again.");
        setLoading(false);
      }
    },
    [batchId, fadeAnim]
  );

  useFocusEffect(
    useCallback(() => {
      const cancelledRef = { current: false };
      loadData(cancelledRef);
      return () => {
        cancelledRef.current = true;
      };
    }, [loadData])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          activeOpacity={0.85}
          onPress={() => loadData({ current: false })}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        {batchInfo?.thumbnail_url ? (
          <Image
            source={{ uri: batchInfo.thumbnail_url }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.headerContent}>
          {batchInfo?.exam_category ? (
            <Text style={styles.headerCategory}>{batchInfo.exam_category}</Text>
          ) : null}
          <Text style={styles.batchTitle} numberOfLines={2}>
            {batchInfo?.title ?? "Batch"}
          </Text>
          <View style={styles.headerFooterRow}>
            {batchInfo?.duration ? <Text style={styles.headerDuration}>{batchInfo.duration}</Text> : null}
            {batchInfo?.fees_inr != null ? (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={styles.headerPrice}>{formatInr(batchInfo.fees_inr)}</Text>
                {batchInfo.original_fees_inr && batchInfo.original_fees_inr > batchInfo.fees_inr ? (
                  <Text style={styles.headerOriginalPrice}>{formatInr(batchInfo.original_fees_inr)}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {tab === "Live" &&
          (liveClasses.length === 0 ? (
            <Empty text="No live/recorded classes yet." />
          ) : (
            liveClasses.map((lc) => (
              <TouchableOpacity
                key={lc.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: "/live/[liveClassId]", params: { liveClassId: lc.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{lc.title}</Text>
                  <Text style={styles.cardMeta}>{new Date(lc.scheduled_at).toLocaleString("en-IN")}</Text>
                </View>
                {lc.is_live ? (
                  <View style={styles.liveTag}>
                    <Text style={styles.liveTagText}>● LIVE</Text>
                  </View>
                ) : (
                  <Text style={styles.playIcon}>▶</Text>
                )}
              </TouchableOpacity>
            ))
          ))}

        {tab === "Lectures" &&
          (lectures.length === 0 ? (
            <Empty text="No recorded lectures yet." />
          ) : (
            lectures.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: "/lecture/[lectureId]", params: { lectureId: l.id } })}
              >
                <Text style={[styles.cardTitle, { flex: 1 }]}>
                  {l.lecture_number ? `${l.lecture_number}. ` : ""}
                  {l.title}
                </Text>
                <Text style={styles.playIcon}>▶</Text>
              </TouchableOpacity>
            ))
          ))}

        {tab === "Tests" &&
          (tests.length === 0 ? (
            <Empty text="No tests for this batch yet." />
          ) : (
            tests.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: "/test/[testId]", params: { testId: t.id } })}
              >
                <Text style={styles.cardTitle}>{t.title}</Text>
                {t.duration_minutes ? <Text style={styles.cardMeta}>⏱ {t.duration_minutes} min</Text> : null}
              </TouchableOpacity>
            ))
          ))}

        {tab === "Notes" &&
          (materials.length === 0 ? (
            <Empty text="No notes/DPPs uploaded yet." />
          ) : (
            materials.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => m.file_url && Linking.openURL(m.file_url)}
              >
                <Text style={styles.pdfIcon}>📄</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle}>{m.title}</Text>
                  <Text style={styles.cardMeta}>Tap to open {(m.material_type ?? "pdf").toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            ))
          ))}
      </ScrollView>
    </Animated.View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc", paddingHorizontal: 30 },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#12183a", marginBottom: 6 },
  errorText: { fontSize: 13, color: "#9ba0bd", textAlign: "center", marginBottom: 18 },
  retryButton: { backgroundColor: "#17358a", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11 },
  retryButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  header: { backgroundColor: "#17358a", position: "relative", overflow: "hidden" },
  headerContent: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 16 },
  headerCategory: { fontSize: 10, fontWeight: "700", color: "#d4af37", textTransform: "uppercase", letterSpacing: 0.6 },
  batchTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 3 },
  headerFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 },
  headerDuration: { fontSize: 11, color: "#c8d0ee" },
  headerPrice: { fontSize: 17, fontWeight: "700", color: "#fff" },
  headerOriginalPrice: { fontSize: 12, color: "#c8d0ee", textDecorationLine: "line-through" },
  tabBar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e6e9f5", flexGrow: 0, paddingVertical: 8, paddingHorizontal: 10 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, borderRadius: 18 },
  tabActive: { backgroundColor: "#17358a" },
  tabText: { fontSize: 13, color: "#5b6280", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#12183a" },
  cardMeta: { fontSize: 11, color: "#9ba0bd", marginTop: 3 },
  liveTag: { backgroundColor: "#fee2e2", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  liveTagText: { fontSize: 10, color: "#dc2626", fontWeight: "700" },
  playIcon: { fontSize: 16, color: "#17358a" },
  pdfIcon: { fontSize: 20 },
  emptyCard: { alignItems: "center", padding: 30 },
  emptyText: { color: "#9ba0bd", fontSize: 13 },
});
