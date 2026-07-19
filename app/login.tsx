import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Animated,
  Modal,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/google-auth";
import { theme } from "@/lib/theme";

function useTapScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 140 }).start();
  return { scale, onPressIn, onPressOut };
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password modal state
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  // Entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(slide, { toValue: 0, duration: 420, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, [fade, slide]);

  const googleTap = useTapScale();
  const loginTap = useTapScale();
  const forgotTap = useTapScale();
  const sendResetTap = useTapScale();

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
    // On success, the root layout's auth listener redirects automatically.
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // On success, the root layout's auth listener redirects automatically.
    } catch (e: any) {
      if (e?.message !== "Google sign-in was cancelled.") {
        Alert.alert("Google sign-in failed", e?.message ?? "Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  function openForgotPassword() {
    setForgotEmail(email.trim());
    setForgotVisible(true);
  }

  async function handleSendReset() {
    const target = forgotEmail.trim();
    if (!target) {
      Alert.alert("Email required", "Please enter your registered email.");
      return;
    }
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: "https://sarvodayaadhyeta.online/reset-password",
      });
      if (error) throw error;
      setForgotVisible(false);
      Alert.alert(
        "Check your email",
        `We've sent a password reset link to ${target}. Open it to set a new password.`
      );
    } catch (e: any) {
      Alert.alert("Couldn't send reset link", e?.message ?? "Please try again.");
    } finally {
      setForgotSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Image source={require("@/assets/icon.png")} style={styles.logo} resizeMode="cover" />
        </View>
        <Text style={styles.brand}>Sarvodaya Adhyeta</Text>
        <Text style={styles.tagline}>A Dream Of Success</Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.formCard}
        keyboardShouldPersistTaps="handled"
        style={{ opacity: fade, transform: [{ translateY: slide }] }}
      >
        <Text style={styles.subtitle}>Login to continue</Text>

        <Animated.View style={{ transform: [{ scale: googleTap.scale }] }}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            onPressIn={googleTap.onPressIn}
            onPressOut={googleTap.onPressOut}
            disabled={googleLoading || loading}
            activeOpacity={1}
          >
            {googleLoading ? (
              <ActivityIndicator color={theme.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#DB4437" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Animated.View style={{ alignSelf: "flex-end", transform: [{ scale: forgotTap.scale }] }}>
          <TouchableOpacity
            onPress={openForgotPassword}
            onPressIn={forgotTap.onPressIn}
            onPressOut={forgotTap.onPressOut}
            activeOpacity={1}
            style={{ paddingVertical: 4 }}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: loginTap.scale }] }}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            onPressIn={loginTap.onPressIn}
            onPressOut={loginTap.onPressOut}
            disabled={loading || googleLoading}
            activeOpacity={1}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.hint}>
          Use the same email/password or Google account as your login on sarvodayadhyeta.online
        </Text>
      </Animated.ScrollView>

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset your password</Text>
            <Text style={styles.modalSubtitle}>
              Enter your registered email — we'll send you a link to set a new password.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setForgotVisible(false)}
                disabled={forgotSending}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Animated.View style={{ flex: 1, transform: [{ scale: sendResetTap.scale }] }}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSendButton]}
                  onPress={handleSendReset}
                  onPressIn={sendResetTap.onPressIn}
                  onPressOut={sendResetTap.onPressOut}
                  disabled={forgotSending}
                  activeOpacity={1}
                >
                  {forgotSending ? (
                    <ActivityIndicator color={theme.navyDark} />
                  ) : (
                    <Text style={styles.modalSendText}>Send Link</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.navy,
  },
  hero: {
    alignItems: "center",
    paddingTop: 64,
    paddingBottom: 36,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#fff",
    padding: 4,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
  },
  brand: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 12,
    color: theme.goldLight,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: "uppercase",
  },
  formCard: {
    flexGrow: 1,
    backgroundColor: theme.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.textPrimary,
    marginBottom: 18,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 13,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textPrimary,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { fontSize: 11, color: theme.textMuted, fontWeight: "600" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 14,
    backgroundColor: "#fff",
    color: theme.textPrimary,
  },
  forgotText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: theme.navy,
    marginBottom: 8,
  },
  button: {
    backgroundColor: theme.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
    shadowColor: theme.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonText: {
    color: theme.navyDark,
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 17,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13,30,82,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 6 },
  modalSubtitle: { fontSize: 12.5, color: theme.textSecondary, marginBottom: 16, lineHeight: 18 },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: { backgroundColor: theme.cream, paddingHorizontal: 18 },
  modalCancelText: { color: theme.textSecondary, fontWeight: "700", fontSize: 13.5 },
  modalSendButton: { backgroundColor: theme.gold },
  modalSendText: { color: theme.navyDark, fontWeight: "700", fontSize: 13.5 },
});
