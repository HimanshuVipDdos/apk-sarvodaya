import { Tabs } from "expo-router";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.navy },
        headerTitleStyle: { color: "#fff", fontWeight: "700" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: theme.navy,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { borderTopColor: theme.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image
                source={require("@/assets/icon.png")}
                style={{ width: 30, height: 30, borderRadius: 15 }}
                resizeMode="contain"
              />
              <Text style={{ color: theme.goldLight, fontSize: 12, fontWeight: "700", letterSpacing: 0.2 }}>
                सर्वोदय है तो उदय है
              </Text>
            </View>
          ),
          headerTitleAlign: "left",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tests"
        options={{
          title: "Tests",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "document-text" : "document-text-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: "Batches",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "school" : "school-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notices",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
