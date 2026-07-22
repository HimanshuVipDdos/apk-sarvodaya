import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, Animated } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { withTimeout } from "@/lib/with-timeout";

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

type SectionState<T> = { loading: boolean; error: string | null; data: T[] };
const initialSection = <T,>(): SectionState<T> => ({ loading: true, error: null, data: [] });

export default function BatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Live");

  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);

  const [live, setLive] = useState<SectionState<LiveClass>>(initialSection);
  const [lectures, setLectures] = useState<SectionState<Lecture>>(initialSection);
  const [tests, setTests] = useState<SectionState<CbtTest>>(initialSection);
  const [materials, setMaterials] = useState<SectionState<Material>>(initialSection);

  const loadedOnce = useRef({ header: false, live: false, lectures: false, tests: false, materials: false });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadHeader = useCallback(async () => {
    if (!loadedOnce.current.header) setHeaderLoading(true);
    setHeaderError(null);
    try {
      const res = await withTimeout(
        supabase.from("batches").select("title, thumbnail_url, fees_inr, original_fees_inr, exam_category, duration").eq("id", batchId).maybeSingle()
      );
      if (!mountedRef.current) return;
      if (res.error) throw res.error;
      setBatchInfo((res.data as any) ?? null);
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (!loadedOnce.current.header) setHeaderError(err?.message ?? "Couldn't load this batch.");
    } finally {
      if (mountedRef.current) setHeaderLoading(false);
      loadedOnce.current.header = true;
    }
  }, [batchId]);

  const loadLive = useCallback(async () => {
    setLive((s) => ({ ...s, loading: !loadedOnce.current.live, error: null }));
    try {
      const res = await withTimeout(
        supabase.from("live_classes").select("id,title,is_live,scheduled_at,youtube_url").eq("batch_id", batchId).order("scheduled_at", { ascending: false })
      );
      if (!mountedRef.current) return;
      if (res.error) throw res.error;
      setLive({ loading: false, error: null, data: (res.data as any) ?? [] });
    } catch (err: any) {
      if (!mountedRef.current) return;
      setLive((s) => ({
        loading: false,
        error: loadedOnce.current.live ? null : err?.message ?? "Couldn't load live classes.",
        data: s.data,
      }));
    } finally {
      loadedOnce.current.live = true;
    }
  }, [batchId]);

  const loadLectures = useCallback(async () => {
    setLectures((s) => ({ ...s, loading: !loadedOnce.current.lectures, error: null }));
    try {
      const res = await withTimeout(
        supabase.from("lectures").select("id,title,lecture_number,youtube_url").eq("batch_id", batchId).eq("is_published", true).order("lecture_number", { ascending: true })
      );
      if (!mountedRef.current) return;
      if (res.error) throw res.error;
      setLectures({ loading: false, error: null, data: (res.data as any) ?? [] });
    } catch (err: any) {
      if (!mountedRef.current) return;
      setLectures((s) => ({
        loading: false,
        error: loadedOnce.current.lectures ? null : err?.message ?? "Couldn't load lectures.",
        data: s.data,
      }));
    } finally {
      loadedOnce.current.lectures = true;
    }
  }, [batchId]);

  const loadTests = useCallback(async () => {
    setTests((s) => ({ ...s, loading: !loadedOnce.current.tests, error: null }));
    try {
      const res = await withTimeout(
        supabase.from("cbt_tests").select("id,title,duration_minutes").eq("batch_id", batchId).eq("is_published", true)
      );
      if (!mountedRef.current) return;
      if (res.error) throw res.error;
      setTests({ loading: false, error: null, data: (res.data as any) ?? [] });
    } catch (err: any) {
      if (!mountedRef.current) return;
      setTests((s) => ({
        loading: false,
        error: loadedOnce.current.tests ? null : err?.message ?? "Couldn't load tests.",
        data: s.data,
      }));
    } finally {
      loadedOnce.current.tests = true;
    }
  }, [batchId]);

  const loadMaterials = useCallback(async () => {
    setMaterials((s) => ({ ...s, loading: !loadedOnce.current.materials, error: null }));
    try {
      const res = await withTimeout(
        supabase.from("study_materials").select("id,title,file_url,material_type").eq("batch_id", batchId).order("created_at", { ascending: false })
      );
      if (!mountedRef.current) return;
      if (res.error) throw res.error;
      setMaterials({ loading: false, error: null, data: (res.data as any) ?? [] });
    } catch (err: any) {
      if (!mountedRef.current) return;
      setMaterials((s) => ({
        loading: false,
        error: loadedOnce.current.materials ? null : err?.message ?? "Couldn't load notes.",
        data: s.data,
      }));
    } finally {
      loadedOnce.current.materials = true;
    }
  }, [batchId]);

  useFocusEffect(
    useCallback(() => {
      try {
        supabase.rpc("tick_live_classes").catch(() => {});
      } catch {
        // ignore — this call must never crash the screen
      }

      loadHeader();
      loadLive();
      loadLectures();
      loadTests();
      loadMaterials();

      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadHeader, loadLive, loadLectures, loadTests, loadMaterials])
  );

  if (headerLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }

  if (headerError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{headerError}</Text>
        <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={loadHeader}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        {batchInfo?.thumbnail_url ? (
          <Image source={{ uri: batchInfo.thumbnail_url }} style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]} resizeMode="cover" />
        ) : null}
        <View style={[styles.headerContent, { paddingTop: insets.top + 18 }]}>
          {batchInfo?.exam_category ? <Text style={styles.headerCategory}>{batchInfo.exam_category}</Text> : null}
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
        {tab === "Live" && (
          <SectionBody
            state={live}
            onRetry={loadLive}
            emptyText="No live/recorded classes yet."
            renderItem={(lc: LiveClass) => (
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
            )}
          />
        )}

        {tab === "Lectures" && (
          <SectionBody
            state={lectures}
            onRetry={loadLectures}
            emptyText="No recorded lectures yet."
            renderItem={(l: Lecture) => (
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
            )}
          />
        )}

        {tab === "Tests" && (
          <SectionBody
            state={tests}
            onRetry={loadTests}
            emptyText="No tests for this batch yet."
            renderItem={(t: CbtTest) => (
              <TouchableOpacity
                key={t.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: "/test/[testId]", params: { testId: t.id } })}
              >
                <Text style={styles.cardTitle}>{t.title}</Text>
                {t.duration_minutes ? <Text style={styles.cardMeta}>⏱ {t.duration_minutes} min</Text> : null}
              </TouchableOpacity>
            )}
          />
        )}

        {tab === "Notes" && (
          <SectionBody
            state={materials}
            onRetry={loadMaterials}
            emptyText="No notes/DPPs uploaded yet."
            renderItem={(m: Material) => (
              <TouchableOpacity
                key={m.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() =>
                  m.file_url &&
                  router.push({ pathname: "/notes-viewer", params: { url: m.file_url, title: m.title } })
                }
              >
                <Text style={styles.pdfIcon}>📄</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle}>{m.title}</Text>
                  <Text style={styles.cardMeta}>Tap to open {(m.material_type ?? "pdf").toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

function SectionBody<T>({
  state,
  onRetry,
  emptyText,
  renderItem,
}: {
  state: SectionState<T>;
  onRetry: () => void;
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  if (state.loading) {
    return (
      <View style={{ paddingVertical: 30, alignItems: "center" }}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }
  if (state.error) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{state.error}</Text>
        <TouchableOpacity style={[styles.retryButton, { marginTop: 10 }]} activeOpacity={0.85} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (state.data.length === 0) {
    return <Empty text={emptyText} />;
  }
  return <>{state.data.map(renderItem)}</>;
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
  headerContent: { paddingHorizontal: 18, paddingBottom: 16 },
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
  emptyText: { color: "#9ba0bd", fontSize: 13, textAlign: "center" },
});
