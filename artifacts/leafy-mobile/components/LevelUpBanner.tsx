import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const LEVEL_LABELS: Record<string, string> = {
  Germoglio: "Germoglio",
  Ramoscello: "Ramoscello",
  Arbusto: "Arbusto",
  Albero: "Albero",
  Foresta: "Foresta",
  Giungla: "Giungla",
};

interface Props {
  visible: boolean;
  fromLevel: string;
  toLevel: string;
  onClose: () => void;
}

export default function LevelUpBanner({ visible, fromLevel, toLevel, onClose }: Props) {
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    if (visible) {
      translateY.value = withSpring(0, { damping: 16, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 280 });

      dismissTimerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 280 });
        translateY.value = withTiming(120, { duration: 320 });
        dismissTimerRef.current = setTimeout(onClose, 330);
      }, 4000);
    } else {
      translateY.value = 120;
      opacity.value = 0;
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const fromLabel = LEVEL_LABELS[fromLevel] ?? fromLevel;
  const toLabel = LEVEL_LABELS[toLevel] ?? toLevel;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrapper, bannerStyle]}>
      <View style={styles.pill}>
        <Text style={styles.emoji}>🌿</Text>
        <Text style={styles.text}>
          <Text style={styles.from}>{fromLabel}</Text>
          <Text style={styles.arrow}> → </Text>
          <Text style={styles.to}>{toLabel}</Text>
        </Text>
        <Text style={styles.emoji}>✨</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(20,40,30,0.93)",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(56,189,80,0.5)",
    shadowColor: "#38BD50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  text: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
  },
  from: {
    color: "rgba(255,255,255,0.65)",
  },
  arrow: {
    color: "#38BD50",
  },
  to: {
    color: "#FFFFFF",
  },
  emoji: {
    fontSize: 16,
  },
});
