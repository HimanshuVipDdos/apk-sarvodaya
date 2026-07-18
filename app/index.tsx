import { View, ActivityIndicator, StyleSheet } from "react-native";

// This screen only ever shows briefly while _layout.tsx checks the session
// and redirects to either /login or /(tabs)/dashboard.
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#17358a" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
});
