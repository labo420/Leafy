import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import BadgeIcon3D from "@/components/BadgeIcon3D";

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
  const bottom = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismiss() {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    opacity.value = withTiming(0, { duration: 260 });
    bottom.value = withSpring(-100, { damping: 20, stiffness: 200 });
    dismissTimerRef.current = setTimeout(onClose, 340);
  }

  useEffect(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    if (visible) {
      bottom.value = withSpring(32, { damping: 18, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 280 });

      dismissTimerRef.current = setTimeout(dismiss, 4000);
    } else {
      bottom.value = -100;
      opacity.value = 0;
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible]);

  const bannerStyle = useAnimatedStyle(() => ({
    bottom: bottom.value,
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const fromLabel = LEVEL_LABELS[fromLevel] ?? fromLevel;
  const toLabel = LEVEL_LABELS[toLevel] ?? toLevel;

  return (
    <Animated.View style={[styles.wrapper, bannerStyle]}>
      <Pressable onPress={dismiss} style={styles.pill}>
        <View style={styles.badgeWrap}>
          <BadgeIcon3D name={toLevel} category="Livello" emoji="" isUnlocked={true} size={38} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.headline}>Livello sbloccato!</Text>
          <Text style={styles.levels}>
            <Text style={styles.from}>{fromLabel}</Text>
            <Text style={styles.arrow}> → </Text>
            <Text style={styles.to}>{toLabel}</Text>
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(14,30,22,0.96)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(56,189,80,0.45)",
    shadowColor: "#38BD50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
  },
  badgeWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flexDirection: "column",
    gap: 1,
  },
  headline: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "#38BD50",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  levels: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
  },
  from: {
    color: "rgba(255,255,255,0.55)",
  },
  arrow: {
    color: "#38BD50",
  },
  to: {
    color: "#FFFFFF",
  },
});
