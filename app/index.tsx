import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { SplashIntro } from "@/components/SplashIntro";

export default function IndexScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();

  return (
    <SplashIntro
      ready={!loading}
      onFinish={() => {
        router.replace(session ? "/(tabs)/dashboard" : "/login");
      }}
    />
  );
}
