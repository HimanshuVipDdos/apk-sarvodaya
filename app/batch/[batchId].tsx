import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type LiveClass = { id: string; title: string; is_live: boolean; scheduled_at: string; youtube_url: string | null };
type Lecture = { id: string; title: string; lecture_number: number | null };
type CbtTest = { id: string; title: string; duration_minutes: number | null };
type Material = { id: string; title: string; file_url: string | null; material_type: string | null };

const TABS = ["Live", "Lectures", "Tests", "Notes"] as const;
type Tab = (typeof TABS)[number];

export default function BatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Live");
  const [loading, setLoading] = useState(true);
  const [batchTitle, setBatchTitle] = useState("");
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [tests, setTests] = useState<CbtTest[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await supabase.rpc("tick_live_classes").catch(() => {});

        const [batchRes, liveRes, lecRes, testRes, matRes] = await Promise.all([
          supabase.from("batches").select("title,name").eq("id", batchId).maybeSingle(),
          supabase.from("live_classes").select("id,title,is_live,scheduled_at,youtube_url").eq("batch_id", batchId).order("scheduled_at", { ascending: false }),
          supabase.from("lectures").select("id,title,lecture_number").eq("batch_id", batchId).eq("is_published", true).order("lecture_number", { ascending: true }),
          supabase.from("cbt_tests").select("id,title,duration_minutes").eq("batch_id", batchId).eq("is_published", true),
          supabase.from("study_materials").select("id,title,file_url,material_type").eq("batch_id", batchId).order("created_at", { ascending: false }),
        ]);

        if (!cancelled) {
          setBatchTitle((batchRes.data as any)?.title ?? (batchRes.data as any)?.name ?? "Batch");
          setLiveClasses((liveRes.data as any) ?? []);
          setLectures((lecRes.data as any) ?? []);
          setTests((testRes.data as any) ?? []);
          setMaterials((matRes.data as any) ?? []);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [batchId])
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
      <View style={styles.header}>
        <Text style={styles.batchTitle} numberOfLines={1}>
          {batchTitle}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
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
              <View key={l.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {l.lecture_number ? `${l.lecture_number}. ` : ""}
                  {l.title}
                </Text>
              </View>
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
    </View>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  header: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: "#17358a" },
  batchTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
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
