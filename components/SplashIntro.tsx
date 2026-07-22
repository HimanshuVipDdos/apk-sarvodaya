import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

// One-time motion-graphics style intro shown on cold app open, before the
// session check redirects to /login or /(tabs)/dashboard. Replaces the old
// plain spinning ActivityIndicator.
export function SplashIntro({
  ready,
  onFinish,
  minDurationMs = 2300,
}: {
  ready: boolean;
  onFinish: () => void;
  minDurationMs?: number;
}) {
  const stageOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoRotateY = useRef(new Animated.Value(1)).current;
  const sweepRotate = useRef(new Animated.Value(0)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(14)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          require("@/assets/intro-chime.mp3"),
          { shouldPlay: true, volume: 0.7 }
        );
        setTimeout(() => sound.unloadAsync().catch(() => {}), 3000);
      } catch {
        // No sound asset bundled yet, or audio unavailable — silent intro is fine.
      }
    })();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(stageOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(logoRotateY, { toValue: 0, duration: 620, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(logoScale, { toValue: 1.12, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        ]),
      ]),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(sweepOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(sweepRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sweepOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(titleTranslate, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    const dotLoop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 420, useNativeDriver: true }),
        ])
      );
    const dotTimer = setTimeout(() => {
      dotLoop(dot1, 0).start();
      dotLoop(dot2, 140).start();
      dotLoop(dot3, 280).start();
    }, 1500);

    const minTimer = setTimeout(() => setMinTimeElapsed(true), minDurationMs);
    return () => {
      clearTimeout(dotTimer);
      clearTimeout(minTimer);
    };
  }, []);

  useEffect(() => {
    if (ready && minTimeElapsed && !exiting) {
      setExiting(true);
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish());
    }
  }, [ready, minTimeElapsed, exiting]);

  const rotateYInterp = logoRotateY.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });
  const sweepDeg = sweepRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "300deg"] });

  return (
    <Animated.View style={[styles.stage, { opacity: Animated.multiply(stageOpacity, exitOpacity) }]}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.glowInner, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />

      <View style={styles.logoWrap}>
        <Animated.View style={[styles.sweepRing, { opacity: sweepOpacity, transform: [{ rotate: sweepDeg }] }]} />
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ perspective: 900 }, { rotateY: rotateYInterp }, { scale: logoScale }],
          }}
        >
          <Image source={require("@/assets/icon.png")} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslate }] }]}>
        Sarvodaya Adhyeta
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        सर्वोदय की ओर, सफलता की राह
      </Animated.Text>

      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.navyDark, alignItems: "center", justifyContent: "center", zIndex: 999 },
  glow: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: theme.gold, opacity: 0.08 },
  glowInner: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: theme.goldLight, opacity: 0.1 },
  logoWrap: { alignItems: "center", justifyContent: "center", width: 150, height: 150, marginBottom: 22 },
  sweepRing: { position: "absolute", width: 148, height: 148, borderRadius: 74, borderWidth: 2.5, borderColor: "transparent", borderTopColor: theme.gold, borderRightColor: theme.goldLight },
  logo: { width: 116, height: 116, borderRadius: 26 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 0.4 },
  tagline: { color: theme.goldLight, fontSize: 12, fontWeight: "600", marginTop: 6, letterSpacing: 0.3 },
  dotsRow: { flexDirection: "row", gap: 8, position: "absolute", bottom: 64 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.gold },
});
