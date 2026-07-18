import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

type Notice = {
  id: string;
  title?: string | null;
  message?: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (error) console.warn(error.message);
          setNotices((data as any) ?? []);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#17358a" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      data={notices}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No notices yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString("en-IN")}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e6e9f5",
  },
  title: { fontSize: 15, fontWeight: "600", color: "#12183a" },
  message: { fontSize: 13, color: "#57534e", marginTop: 4 },
  date: { fontSize: 11, color: "#9ba0bd", marginTop: 8 },
  emptyCard: { alignItems: "center", padding: 30 },
  emptyText: { color: "#9ba0bd", fontSize: 13 },
});
