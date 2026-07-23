import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { useIsAdmin } from "@/lib/is-admin";
import { RiseIn, PressScale } from "@/components/Motion";

export default function AdminHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAdmin, checked } = useIsAdmin();

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.cream }}>
        <ActivityIndicator color={theme.navy} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24 }}>
      <RiseIn>
        <Text style={styles.heading}>Admin Tools</Text>

        <Text style={styles.subheading}>
          Quick actions from your phone. For full control (question bank, bulk uploads, AI
          parser, enrollments, results etc.) use the website admin panel — everything you do
          here or there shows up in both places instantly, same database.
        </Text>
      </RiseIn>

      <RiseIn delay={80}>
        <PressScale style={styles.card} onPress={() => router.push("/admin/hero-slides")}>
          <View style={styles.iconWrap}>
            <Ionicons name="images" size={20} color={theme.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Homepage Slider</Text>
            <Text style={styles.cardDesc}>Add, reorder, or remove the promo images shown at the top of the app & website.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </PressScale>
      </RiseIn>

      <RiseIn delay={140}>
        <PressScale style={styles.card} onPress={() => router.push("/admin/notices")}>
          <View style={styles.iconWrap}>
            <Ionicons name="megaphone" size={20} color={theme.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Notices</Text>
            <Text style={styles.cardDesc}>Post vacancy/admit-card/result notices instantly to all students.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </PressScale>
      </RiseIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cream },
  heading: { fontSize: 20, fontWeight: "700", color: theme.textPrimary },
  subheading: { fontSize: 12, color: theme.textSecondary, marginTop: 6, marginBottom: 22, lineHeight: 18 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eef1fb",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
  cardDesc: { fontSize: 11, color: theme.textSecondary, marginTop: 3, lineHeight: 16 },
});
