import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const onLoginScreen = segments[0] === "login";

    if (!session && !onLoginScreen) {
      // Not logged in and not already on login -> send to login
      router.replace("/login");
    } else if (session && !inTabsGroup) {
      // Logged in but sitting on index/login -> send to dashboard
      router.replace("/(tabs)/dashboard");
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id).catch((err) =>
        console.warn("Push registration failed:", err)
      );
    }
  }, [session?.user?.id]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
