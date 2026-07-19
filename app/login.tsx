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
  Animated,
  Modal,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/google-auth";
import { theme } from "@/lib/theme";
import { RiseIn, PopIn, PressScale, useFloat } from "@/components/Motion";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password modal state
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  // Shake feedback on failed login (form card)
  const shake = useRef(new Animated.Value(0)).current;
  function playShake() {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }
  const shakeTranslate = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  // Decorative floating glow blobs behind the hero — purely cosmetic, cheap (2 native transforms)
  const floatA = useFloat(14, 3400);
  const floatB = useFloat(10, 2600);

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing details", "Please enter both email and password.");
      playShake();
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      playShake();
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Login failed", error.message);
      playShake();
    }
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
    if (!EMAIL_RE.test(target)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
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
    <View style={styles.container}>
      {/* Hero has a dark navy background, so status bar content needs to be
          light here — root layout defaults to "dark" for the rest of the app,
          this local override only applies while this screen is mounted. */}
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -80}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <Animated.View
            style={[styles.blobA, { transform: [{ translateY: floatA }] }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.blobB, { transform: [{ translateY: floatB }] }]}
            pointerEvents="none"
          />

          <PopIn>
            <View style={styles.logoRing}>
              <Image source={require("@/assets/icon.png")} style={styles.logo} resizeMode="cover" />
            </View>
          </PopIn>
          <RiseIn delay={80}>
            <Text style={styles.brand}>Sarvodaya Adhyeta</Text>
          </RiseIn>
          <RiseIn delay={140}>
            <Text style={styles.tagline}>A Dream Of Success</Text>
          </RiseIn>
        </View>

        <Animated.ScrollView
          contentContainerStyle={[styles.formCard, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ transform: [{ translateX: shakeTranslate }] }}
        >
          <RiseIn delay={100}>
            <Text style={styles.subtitle}>Login to continue</Text>
          </RiseIn>

          <RiseIn delay={150}>
            <PressScale onPress={handleGoogleLogin} disabled={googleLoading || loading} style={styles.googleButton}>
              {googleLoading ? (
                <ActivityIndicator color={theme.textPrimary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#DB4437" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </PressScale>
          </RiseIn>

          <RiseIn delay={190}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          </RiseIn>

          <RiseIn delay={220}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
            />
          </RiseIn>

          <RiseIn delay={260}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.eyeButton}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={19} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </RiseIn>

          <RiseIn delay={290} style={{ alignSelf: "flex-end" }}>
            <TouchableOpacity onPress={openForgotPassword} activeOpacity={0.6} style={{ paddingVertical: 4 }}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </RiseIn>

          <RiseIn delay={320}>
            <PressScale onPress={handleLogin} disabled={loading || googleLoading} style={styles.button}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </PressScale>
          </RiseIn>

          <RiseIn delay={360}>
            <Text style={styles.hint}>
              Use the same email/password or Google account as your login on sarvodayaadhyeta.online
            </Text>
          </RiseIn>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
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
              autoCorrect={false}
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
              <PressScale
                onPress={handleSendReset}
                disabled={forgotSending}
                style={[styles.modalButton, styles.modalSendButton, { flex: 1 }]}
              >
                {forgotSending ? (
                  <ActivityIndicator color={theme.navyDark} />
                ) : (
                  <Text style={styles.modalSendText}>Send Link</Text>
                )}
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.navy,
  },
  hero: {
    alignItems: "center",
    paddingBottom: 36,
    overflow: "hidden",
  },
  blobA: {
    position: "absolute",
    top: -30,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.goldLight,
    opacity: 0.14,
  },
  blobB: {
    position: "absolute",
    bottom: -20,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ffffff",
    opacity: 0.08,
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
    textAlign: "center",
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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 14,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.textPrimary,
  },
  eyeButton: {
    padding: 8,
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
