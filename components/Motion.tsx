import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View, Text, StyleSheet } from "react-native";

// ---------------------------------------------------------------------------
// Shared motion building blocks used across the app (dashboard, results,
// batch/test screens, etc). Everything here is built on the RN core
// `Animated` API only — no extra native dependency, no extra EAS rebuild,
// safe to drop into any screen. Transform/opacity animations use the native
// driver (run on the UI thread, never janky even under JS load); only width
// fills use the JS driver since layout props can't be native-driven.
// ---------------------------------------------------------------------------

/** Fades + rises a block into place. Use `delay` to stagger a list of them. */
export function RiseIn({
  children,
  delay = 0,
  duration = 480,
  distance = 18,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Scales a block in with a soft spring pop — good for icons/badges/heroes. */
export function PopIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay,
      useNativeDriver: true,
      speed: 14,
      bounciness: 9,
    }).start();
  }, [anim, delay]);

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ scale: anim }] }]}>
      {children}
    </Animated.View>
  );
}

/** Wraps any pressable content with a tactile press-scale + opacity dip. */
export function PressScale({
  children,
  style,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** A number that animates from 0 up to `value` once. */
export function CountUpText({
  value,
  suffix = "",
  decimals = 0,
  style,
  delay = 0,
  duration = 700,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  style?: any;
  delay?: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState("0" + suffix);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(`${v.toFixed(decimals)}${suffix}`));
    Animated.timing(anim, {
      toValue: value,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

/** Animated horizontal fill bar. */
export function FillBar({
  percent,
  color,
  trackColor = "#e6e9f5",
  height = 8,
  delay = 0,
}: {
  percent: number;
  color: string;
  trackColor?: string;
  height?: number;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, percent, delay]);

  return (
    <View style={[styles.trackBase, { height, backgroundColor: trackColor, borderRadius: height }]}>
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        }}
      />
    </View>
  );
}

/** Gentle continuous pulse — for skeleton loaders. Caller controls when it runs via `active`. */
export function usePulse(active: boolean) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    if (active) loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return pulse;
}

/** Slow, endless drift — used for decorative background blobs so hero
 * sections never feel static, without costing any real CPU (single native
 * animation, transform only). */
export function useFloat(range = 10, duration = 3200) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0, range] });
}

const styles = StyleSheet.create({
  trackBase: { width: "100%", overflow: "hidden" },
});
