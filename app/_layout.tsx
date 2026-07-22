import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";
import * as ScreenOrientation from "expo-screen-orientation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // App-wide default is portrait (app.json now sets "orientation": "default"
  // instead of "portrait" so this can be overridden temporarily). Only the
  // live-class and lecture player screens ever unlock this, for fullscreen
  // landscape playback, and they always relock portrait when they unmount —
  // see app/live/[liveClassId].tsx and app/lecture/[lectureId].tsx.
  useEffect(() => {
    const inVideoScreen = segments[0] === "live" || segments[0] === "lecture";
    if (!inVideoScreen) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, [segments]);

  useEffect(() => {
    try {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } catch (e) {
      // native module not available in this build yet — ignore
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const onLoginScreen = segments[0] === "login";
    const onIndexScreen = segments.length === 0;

    // The index screen (splash intro) now handles its own redirect once the
    // animation finishes — don't race it with an immediate redirect here.
    if (onIndexScreen) return;

    if (!session && !onLoginScreen) {
      router.replace("/login");
    } else if (session && onLoginScreen) {
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
