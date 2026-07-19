import { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, TouchableOpacity, Dimensions, FlatList, Linking } from "react-native";
import { supabase } from "@/lib/supabase";

// Mirrors the website's src/components/hero-slider.tsx: reads the same
// `hero_slides` table (is_active + sort_order), autoplays, and opens the
// same link types (whatsapp / url) on tap.
type HeroSlide = {
  id: string;
  image_url: string;
  link_type: string;
  link_value: string | null;
};

const AUTOPLAY_MS = 3500;
const { width } = Dimensions.get("window");
const SLIDE_HEIGHT = Math.round(width * (9 / 21)); // similar wide-banner ratio to the website

function buildHref(slide: HeroSlide): string | null {
  if (slide.link_type === "whatsapp" && slide.link_value) {
    const digits = slide.link_value.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (slide.link_type === "url" && slide.link_value) {
    const v = slide.link_value.trim();
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }
  return null;
}

export function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const hoverPaused = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("hero_slides")
        .select("id, image_url, link_type, link_value")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!cancelled) setSlides((data as HeroSlide[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => {
      if (hoverPaused.current) return;
      setIndex((i) => {
        const next = (i + 1) % count;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (hoverPaused.current = true)}
        onScrollEndDrag={() => (hoverPaused.current = false)}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => {
          const href = buildHref(item);
          const content = (
            <View style={{ width, height: SLIDE_HEIGHT, backgroundColor: "#0d1e52" }}>
              <Image
                source={{ uri: item.image_url }}
                style={StyleSheet.absoluteFillObject}
                blurRadius={20}
                resizeMode="cover"
              />
              <Image source={{ uri: item.image_url }} style={styles.fullImage} resizeMode="contain" />
            </View>
          );
          return href ? (
            <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(href)}>
              {content}
            </TouchableOpacity>
          ) : (
            content
          );
        }}
      />
      {count > 1 && (
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullImage: { width: "100%", height: "100%" },
  dotsRow: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 16, backgroundColor: "#fff" },
});
