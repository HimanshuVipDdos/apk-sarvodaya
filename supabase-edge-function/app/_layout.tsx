import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // App-wide screenshot/screen-recording block. On Android this fully blocks
  // both (system shows a black frame). On iOS, Apple does not let apps block
  // screenshots — only screen recording of protected content can be flagged —
  // so this is best-effort there.
  // Wrapped defensively: if this native module isn't part of the currently
  // installed build yet (it was just added — needs a fresh `eas build`, a
  // plain JS/Metro reload is NOT enough), this must never crash the app.
  useEffect(() => {
    try {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } catch {
      // native module not available in this build yet — ignore
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const onLoginScreen = segments[0] === "login";
    const onIndexScreen = segments.length === 0;

    if (!session && !onLoginScreen) {
      // Not logged in and not already on login -> send to login
      router.replace("/login");
    } else if (session && (onLoginScreen || onIndexScreen)) {
      // Logged in but sitting on index/login -> send to dashboard.
      // (Only redirect from login/index — NOT from every screen outside
      // (tabs), otherwise opening a batch/live-class/test bounces straight
      // back to the dashboard.)
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
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </ErrorBoundary>
  );
}
