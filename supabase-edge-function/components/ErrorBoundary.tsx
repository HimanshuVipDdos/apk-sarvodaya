import { Component, type ReactNode } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

type Props = { children: ReactNode };
type State = { error: Error | null };

// Without this, an uncaught error anywhere in the tree makes React Native
// unmount everything and the screen just goes blank/white with zero clues.
// This catches it and prints the real error + stack so it can actually be
// diagnosed instead of guessed at.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.title}>Something crashed</Text>
            <Text style={styles.message}>{this.state.error.message}</Text>
            <Text style={styles.stack}>{this.state.error.stack}</Text>
            <TouchableOpacity style={styles.button} onPress={() => this.setState({ error: null })}>
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  title: { fontSize: 18, fontWeight: "800", color: theme.dangerText, marginBottom: 10 },
  message: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 14 },
  stack: { fontSize: 11, color: theme.textMuted, marginBottom: 20 },
  button: { backgroundColor: theme.navy, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
