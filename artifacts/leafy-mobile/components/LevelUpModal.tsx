import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
  ImageSourcePropType,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import ConfettiCannon from "react-native-confetti-cannon";
import Colors from "@/constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const LEVEL_BADGE_IMAGES: Record<string, ImageSourcePropType> = {
  Germoglio: require("@/assets/badges/level-germoglio.png"),
  Ramoscello: require("@/assets/badges/level-ramoscello.png"),
  Arbusto: require("@/assets/badges/level-arbusto.png"),
  Albero: require("@/assets/badges/level-albero.png"),
  Foresta: require("@/assets/badges/level-foresta.png"),
};

const LEVEL_EMOJI: Record<string, string> = {
  Germoglio: "🌱",
  Ramoscello: "🌿",
  Arbusto: "🍃",
  Albero: "🌳",
  Foresta: "🌲",
};

interface LevelUpModalProps {
  visible: boolean;
  fromLevel: string;
  toLevel: string;
  onClose: () => void;
}

const PULSE_DURATION = 1800;
const FLASH_DELAY = PULSE_DURATION;
const REVEAL_DELAY = FLASH_DELAY + 400;
const AUTO_CLOSE_DELAY = REVEAL_DELAY + 3000;

export default function LevelUpModal({
  visible,
  fromLevel,
  toLevel,
  onClose,
}: LevelUpModalProps) {
  const oldScale = useSharedValue(1);
  const oldOpacity = useSharedValue(1);
  const flashScale = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const newScale = useSharedValue(0);
  const newOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearTimers = () => {
    if (autoCloseTimer.current) { clearTimeout(autoCloseTimer.current); autoCloseTimer.current = null; }
    if (confettiTimer.current) { clearTimeout(confettiTimer.current); confettiTimer.current = null; }
  };

  useEffect(() => {
    if (!visible) {
      clearTimers();
      return;
    }

    oldScale.value = 1;
    oldOpacity.value = 1;
    flashScale.value = 0;
    flashOpacity.value = 0;
    newScale.value = 0;
    newOpacity.value = 0;
    textOpacity.value = 0;
    backdropOpacity.value = 0;

    backdropOpacity.value = withTiming(1, { duration: 300 });

    oldScale.value = withSequence(
      withTiming(1.05, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.95, { duration: 250 }),
      withTiming(1.1, { duration: 200 }),
      withTiming(0.9, { duration: 180 }),
      withTiming(1.15, { duration: 160 }),
      withTiming(0.85, { duration: 140 }),
      withTiming(1.25, { duration: 120 }),
      withTiming(0.8, { duration: 100 }),
      withTiming(1.35, { duration: 80 }),
      withTiming(0.75, { duration: 60 }),
      withTiming(1.5, { duration: 50 }),
    );

    oldOpacity.value = withDelay(
      PULSE_DURATION - 100,
      withTiming(0, { duration: 150 }),
    );

    flashOpacity.value = withDelay(
      FLASH_DELAY,
      withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 500 }),
      ),
    );
    flashScale.value = withDelay(
      FLASH_DELAY,
      withTiming(3, { duration: 400, easing: Easing.out(Easing.ease) }),
    );

    newScale.value = withDelay(
      REVEAL_DELAY,
      withSpring(1, { damping: 8, stiffness: 120, mass: 0.8 }),
    );
    newOpacity.value = withDelay(
      REVEAL_DELAY,
      withTiming(1, { duration: 200 }),
    );

    textOpacity.value = withDelay(
      REVEAL_DELAY + 400,
      withTiming(1, { duration: 400 }),
    );

    confettiTimer.current = setTimeout(() => {
      if (mountedRef.current) confettiRef.current?.start();
    }, REVEAL_DELAY + 200);

    autoCloseTimer.current = setTimeout(() => {
      if (mountedRef.current) onClose();
    }, AUTO_CLOSE_DELAY);

    return clearTimers;
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const oldBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: oldScale.value }],
    opacity: oldOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flashScale.value }],
    opacity: flashOpacity.value,
  }));

  const newBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: newScale.value }],
    opacity: newOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!visible) return null;

  const fromImage = LEVEL_BADGE_IMAGES[fromLevel] ?? LEVEL_BADGE_IMAGES.Germoglio;
  const toImage = LEVEL_BADGE_IMAGES[toLevel] ?? LEVEL_BADGE_IMAGES.Germoglio;
  const toEmoji = LEVEL_EMOJI[toLevel] ?? "🌱";

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Pressable style={s.overlay} onPress={onClose}>
        <Animated.View style={[s.backdrop, backdropStyle]} />

        <View style={s.center}>
          <Animated.View style={[s.badgeWrap, oldBadgeStyle]}>
            <Image source={fromImage} style={s.badgeImage} resizeMode="contain" />
          </Animated.View>

          <Animated.View style={[s.flash, flashStyle]} />

          <Animated.View style={[s.badgeWrap, newBadgeStyle]}>
            <Image source={toImage} style={s.badgeImage} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.View style={[s.textBox, textStyle]}>
          <Text style={s.title}>Nuovo livello!</Text>
          <Text style={s.subtitle}>
            Sei diventato un {toLevel}! {toEmoji}
          </Text>
        </Animated.View>

        <ConfettiCannon
          ref={confettiRef}
          count={80}
          origin={{ x: SCREEN_W / 2, y: -20 }}
          autoStart={false}
          fadeOut
          fallSpeed={3000}
          explosionSpeed={400}
          colors={["#2E6B50", "#4CAF50", "#81C784", "#FFD700", "#A5D6A7", "#C8E6C9"]}
        />
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  center: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWrap: {
    position: "absolute",
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeImage: {
    width: 140,
    height: 140,
  },
  flash: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#A5D6A7",
  },
  textBox: {
    marginTop: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
  },
});
