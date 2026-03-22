import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import BadgeIcon3D from "@/components/BadgeIcon3D";
import { XpIcon } from "../../components/XpIcon";
import { LeaIcon } from "../../components/LeaIcon";
import { GoogleIcon } from "../../components/GoogleIcon";
import { FacebookIcon } from "../../components/FacebookIcon";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeInDown,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";
import { useNotifications } from "@/context/notifications";
import { useTheme } from "@/context/theme";
import { apiFetch } from "@/lib/api";
import { useNearbyLocations, type NearbyLocation } from "@/hooks/useNearbyLocations";
import { useWalkin } from "@/hooks/useWalkin";
import type { Profile, DailyCheckinResponse } from "@workspace/api-client-react";
import LeafyGoldModal from "@/components/LeafyGoldModal";

const LEVEL_LABELS: Record<string, string> = {
  Germoglio: "Germoglio",
  Ramoscello: "Ramoscello",
  Arbusto: "Arbusto",
  Albero: "Albero",
  Foresta: "Foresta",
  Giungla: "Giungla",
};

const LEVEL_CONFIG = [
  { name: "Germoglio", emoji: "🌱", minPts: 0, color: "#8BC34A", fruitColor: "#8BC34A", nodeSize: 26, imgSize: 26 },
  { name: "Ramoscello", emoji: "🌿", minPts: 500, color: "#66BB6A", fruitColor: "#8BC34A", nodeSize: 36, imgSize: 36 },
  { name: "Arbusto", emoji: "🍃", minPts: 2000, color: "#43A047", fruitColor: "#F4D03F", nodeSize: 48, imgSize: 48 },
  { name: "Albero", emoji: "🌳", minPts: 5000, color: "#2E7D32", fruitColor: "#FF8C42", nodeSize: 62, imgSize: 62 },
  { name: "Foresta", emoji: "🌲", minPts: 10000, color: "#1B5E20", fruitColor: "#E74C3C", nodeSize: 78, imgSize: 78 },
  { name: "Giungla", emoji: "🌴", minPts: 25000, color: "#004D25", fruitColor: "#FFD700", nodeSize: 90, imgSize: 90 },
];



const RING_SIZE = 240;
const RING_STROKE = 16;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;
const N_SEGS = 60;

const SWEEP_STOPS: { t: number; r: number; g: number; b: number }[] = [
  { t: 0,    r: 170, g: 223, b: 42  },
  { t: 0.33, r: 255, g: 214, b: 0   },
  { t: 0.67, r: 255, g: 107, b: 0   },
  { t: 1,    r: 245, g: 59,  b: 59  },
];

function sweepColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  let lo = SWEEP_STOPS[0];
  let hi = SWEEP_STOPS[SWEEP_STOPS.length - 1];
  for (let i = 0; i < SWEEP_STOPS.length - 1; i++) {
    if (t <= SWEEP_STOPS[i + 1].t) {
      lo = SWEEP_STOPS[i];
      hi = SWEEP_STOPS[i + 1];
      break;
    }
  }
  const f = hi.t > lo.t ? (t - lo.t) / (hi.t - lo.t) : 0;
  return `rgb(${Math.round(lo.r + f * (hi.r - lo.r))},${Math.round(lo.g + f * (hi.g - lo.g))},${Math.round(lo.b + f * (hi.b - lo.b))})`;
}

function arcSegPath(a1: number, a2: number): string {
  const x1 = (RING_CX + RING_RADIUS * Math.cos(a1)).toFixed(3);
  const y1 = (RING_CY + RING_RADIUS * Math.sin(a1)).toFixed(3);
  const x2 = (RING_CX + RING_RADIUS * Math.cos(a2)).toFixed(3);
  const y2 = (RING_CY + RING_RADIUS * Math.sin(a2)).toFixed(3);
  return `M ${x1} ${y1} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${x2} ${y2}`;
}

const LEVEL_MCI_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  Germoglio: "sprout",
  Ramoscello: "leaf",
  Arbusto: "leaf-maple",
  Albero: "tree",
  Foresta: "forest",
  Giungla: "palm-tree",
};

const BP_PRIZES_DISPLAY = [
  { type: "drops" as const, label: "50" },
  { type: "lea" as const, label: "5 LEA" },
  { type: "drops" as const, label: "75" },
  { type: "lea" as const, label: "8 LEA" },
  { type: "drops" as const, label: "100" },
  { type: "lea" as const, label: "10 LEA" },
  { type: "both" as const, label: "150+15" },
];

const ICON_BASE_SIZE = 90;
const ICON_MIN_SCALE = 0.75;
const ICON_MAX_SCALE = 1.0;
const CAN_TOP = 32;
const CAN_LEFT = RING_SIZE / 2 + 12;
const CAN_PIVOT = 17;
const DROP_TOP = 62;
const DROP_LEFT = RING_SIZE / 2 + 14;
const DROP_TRAVEL = 50;

function LevelProgressRing({
  progress,
  level,
  points,
  nextLevelPoints: apiNextLevelPoints,
}: {
  progress: number;
  level: string;
  points: number;
  nextLevelPoints: number;
}) {
  const { mode } = useTheme();
  const onDark = mode === "dark";
  const trackColor = onDark ? "rgba(255,255,255,0.15)" : "rgba(46,107,80,0.13)";
  const borderColor = onDark ? "rgba(255,255,255,0.22)" : "rgba(46,107,80,0.28)";
  const iconColor = onDark ? "rgba(255,255,255,0.90)" : "#2E6B50";
  const nameColor = onDark ? "rgba(255,255,255,0.85)" : "#1A3028";
  const xpSubColor = onDark ? "rgba(255,255,255,0.55)" : "rgba(26,48,40,0.55)";
  const nextLvlColor = onDark ? "rgba(255,255,255,0.70)" : "rgba(26,48,40,0.60)";

  // ── Ring entry spring ──
  const ringScale = useSharedValue(0.82);
  useEffect(() => {
    ringScale.value = withSpring(1, { damping: 14, stiffness: 90 });
  }, [progress]);
  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  // ── Badge icon size scales with progress ──
  const targetIconScale = ICON_MIN_SCALE + (progress / 100) * (ICON_MAX_SCALE - ICON_MIN_SCALE);
  const iconScale = useSharedValue(targetIconScale);
  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  // ── Badge level cross-fade ──
  const prevLevelRef = useRef(level);
  const badgeOpacity = useSharedValue(1);
  const badgeVScale = useSharedValue(1);
  const badgeAnimStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeVScale.value }],
  }));

  // ── Watering can animation ──
  const prevPointsRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  // ── Animated progress bar ──
  const [displayProgress, setDisplayProgress] = useState(progress);
  const displayProgressRef = useRef(progress);
  const rafRef = useRef<number | null>(null);
  const progTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateProgress = React.useCallback((from: number, to: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const duration = 700;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + eased * (to - from);
      displayProgressRef.current = val;
      setDisplayProgress(val);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const canOpacity = useSharedValue(0);
  const canRotate = useSharedValue(0);
  const dropOpacity = useSharedValue(0);
  const dropY = useSharedValue(0);

  const canAnimStyle = useAnimatedStyle(() => ({
    opacity: canOpacity.value,
    transform: [
      { translateX: CAN_PIVOT },
      { translateY: CAN_PIVOT },
      { rotate: `${canRotate.value}deg` },
      { translateX: -CAN_PIVOT },
      { translateY: -CAN_PIVOT },
      { scaleX: -1 },
    ],
  }));
  const dropAnimStyle = useAnimatedStyle(() => ({
    opacity: dropOpacity.value,
    transform: [{ translateY: dropY.value }],
  }));

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevPointsRef.current = points;
      prevLevelRef.current = level;
      return;
    }

    const prev = prevPointsRef.current ?? points;
    const prevLev = prevLevelRef.current;
    prevPointsRef.current = points;
    prevLevelRef.current = level;

    const newIconScale = ICON_MIN_SCALE + (progress / 100) * (ICON_MAX_SCALE - ICON_MIN_SCALE);

    // Level evolution animation
    if (prevLev !== level) {
      displayProgressRef.current = progress;
      setDisplayProgress(progress);
      badgeOpacity.value = withSequence(
        withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
        withDelay(60, withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) })),
      );
      badgeVScale.value = withSequence(
        withTiming(0.45, { duration: 220, easing: Easing.out(Easing.quad) }),
        withDelay(60, withSpring(1, { damping: 9, stiffness: 130 })),
      );
      iconScale.value = withDelay(280, withSpring(newIconScale, { damping: 10, stiffness: 90 }));
      return;
    }

    // Drops gain: watering animation
    if (points > prev && prev > 0) {
      // Cancel any in-flight animations
      if (progTimeoutRef.current) clearTimeout(progTimeoutRef.current);
      if (hapticTimeoutRef.current) clearTimeout(hapticTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const oldP = displayProgressRef.current;
      const newP = progress;

      // Can fades in (450ms), holds (1750ms), fades out (500ms) → total 2700ms
      canOpacity.value = withSequence(
        withTiming(1, { duration: 450 }),
        withTiming(1, { duration: 1750 }),
        withTiming(0, { duration: 500 }),
      );
      // Can tilts 35° to pour then returns → total 2200ms
      canRotate.value = withSequence(
        withTiming(0, { duration: 100 }),
        withTiming(35, { duration: 750, easing: Easing.out(Easing.quad) }),
        withTiming(35, { duration: 700 }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.quad) }),
      );
      // Droplet: wait 950ms, appear 120ms, fall 900ms, fade 300ms → total 2270ms
      dropOpacity.value = withSequence(
        withTiming(0, { duration: 950 }),
        withTiming(1, { duration: 120 }),
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 300 }),
      );
      dropY.value = withSequence(
        withTiming(0, { duration: 950 }),
        withTiming(DROP_TRAVEL, { duration: 1020, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      );

      // ── AT DROP LANDING (950 + 1020 = 1970ms) ──

      // 1. Badge shimmer just before spring (1920ms)
      badgeOpacity.value = withDelay(1920, withSequence(
        withTiming(0.5, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      ));

      // 2. Badge springs when drop lands
      iconScale.value = withDelay(
        1970,
        withSpring(newIconScale, { damping: 6, stiffness: 130, mass: 0.8 }),
      );


      // 4. Haptic tick at landing
      hapticTimeoutRef.current = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 1970);

      // 5. Progress bar fills at landing
      progTimeoutRef.current = setTimeout(() => animateProgress(oldP, newP), 1970);

    } else {
      displayProgressRef.current = progress;
      setDisplayProgress(progress);
      iconScale.value = withSpring(newIconScale, { damping: 12, stiffness: 80 });
    }

    return () => {
      if (progTimeoutRef.current) clearTimeout(progTimeoutRef.current);
      if (hapticTimeoutRef.current) clearTimeout(hapticTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [points, progress, level]);

  const currentIdx = LEVEL_CONFIG.findIndex(l => l.name === level);
  const safeIdx = currentIdx >= 0 ? currentIdx : 0;
  const isMaxLevel = safeIdx >= LEVEL_CONFIG.length - 1;
  const nextLevel = isMaxLevel ? null : LEVEL_CONFIG[safeIdx + 1];
  const pointsRemaining = isMaxLevel ? 0 : Math.max(0, apiNextLevelPoints - points);
  const targetPts = isMaxLevel ? LEVEL_CONFIG[safeIdx].minPts : apiNextLevelPoints;

  const totalAngle = (displayProgress / 100) * 2 * Math.PI;
  const segAngle = N_SEGS > 0 ? totalAngle / N_SEGS : 0;
  const endCapX = RING_CX + RING_RADIUS * Math.cos(totalAngle);
  const endCapY = RING_CY + RING_RADIUS * Math.sin(totalAngle);

  const levelIcon = LEVEL_MCI_ICONS[level] ?? "sprout";

  return (
    <Animated.View style={[ringStyles.outerContainer, containerAnimStyle]}>
      <View style={ringStyles.container}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
          {/* Outer border ring */}
          <Circle
            cx={RING_CX}
            cy={RING_CY}
            r={RING_RADIUS + RING_STROKE / 2 + 1.5}
            stroke={borderColor}
            strokeWidth={1.5}
            fill="none"
          />
          <Circle
            cx={RING_CX}
            cy={RING_CY}
            r={RING_RADIUS}
            stroke={trackColor}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {displayProgress > 0 && Array.from({ length: N_SEGS }, (_, i) => {
            const a1 = i * segAngle;
            const a2 = (i + 1) * segAngle;
            const t = (i + 0.5) * displayProgress / (100 * N_SEGS);
            return (
              <Path
                key={i}
                d={arcSegPath(a1, a2)}
                stroke={sweepColor(t)}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="butt"
              />
            );
          })}
          {displayProgress > 0 && displayProgress < 100 && (
            <Circle
              cx={endCapX}
              cy={endCapY}
              r={RING_STROKE / 2}
              fill={sweepColor(displayProgress / 100)}
            />
          )}
        </Svg>

        {/* Center: badge icon + text */}
        <View style={ringStyles.innerContent}>
          <Animated.View style={badgeAnimStyle}>
            <Animated.View style={iconAnimStyle}>
              <BadgeIcon3D name={level} category="Livello" emoji="" isUnlocked={true} size={ICON_BASE_SIZE} />
            </Animated.View>
          </Animated.View>
          <Text style={[ringStyles.levelName, { color: nameColor }]}>{LEVEL_LABELS[level] ?? level}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Text style={[ringStyles.xpProgress, { color: "#38BDF8" }]}>
              {new Intl.NumberFormat("it-IT").format(points)} / {new Intl.NumberFormat("it-IT").format(targetPts)}
            </Text>
            <XpIcon size={22} />
          </View>
        </View>

        {/* Watering can overlay */}
        <Animated.Image
          source={require("@/assets/images/watering-can-icon.png")}
          style={[ringStyles.wateringCan, canAnimStyle, { width: 52, height: 52 }]}
          resizeMode="contain"
        />

        {/* Droplet */}
        <Animated.Image
          source={require("@/assets/images/drop-anim.png")}
          style={[ringStyles.droplet, dropAnimStyle]}
          resizeMode="contain"
        />
      </View>

      <Text style={[ringStyles.nextLevelText, { color: nextLvlColor }]} numberOfLines={3}>
        {isMaxLevel
          ? "Hai raggiunto il massimo livello!"
          : `Ti mancano solo ${new Intl.NumberFormat("it-IT").format(pointsRemaining)} drops per sbloccare ${nextLevel!.name} e ottenere i nuovi vantaggi.`}
      </Text>
    </Animated.View>
  );
}

const ringStyles = StyleSheet.create({
  outerContainer: {
    alignItems: "center",
    paddingBottom: 4,
  },
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  innerContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  levelName: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  xpProgress: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.2,
  },
  nextLevelText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  wateringCan: {
    position: "absolute",
    top: CAN_TOP,
    left: CAN_LEFT,
    zIndex: 10,
  },
  droplet: {
    position: "absolute",
    top: DROP_TOP,
    left: DROP_LEFT - 7,
    width: 18,
    height: 24,
    zIndex: 10,
  },
});

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AccordionSection = "login" | "register" | null;

function GuestAuthScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();

  const [expanded, setExpanded] = useState<AccordionSection>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleSection = (section: "login" | "register") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setError(null);
    setEmail("");
    setPassword("");
    setUsername("");
    setShowPassword(false);
    setExpanded((prev) => (prev === section ? null : section));
  };

  const handleSubmit = async () => {
    if (!expanded) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      return;
    }
    if (expanded === "register" && !username.trim()) {
      setError("Inserisci un nome utente.");
      return;
    }
    if (password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri.");
      return;
    }
    setLoading(true);
    try {
      const endpoint = expanded === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = expanded === "login"
        ? { email, password }
        : { email, password, username };
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Si è verificato un errore.");
        return;
      }
      if (data.user) {
        setUser(data.user);
      }
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const renderFormFields = (section: "login" | "register") => (
    <View style={authStyles.accordionBody}>
      {section === "register" && (
        <View style={authStyles.inputWrap}>
          <Feather name="user" size={16} color="rgba(255,255,255,0.5)" style={authStyles.inputIcon} />
          <TextInput
            style={authStyles.input}
            placeholder="Nome utente"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      <View style={authStyles.inputWrap}>
        <Feather name="mail" size={16} color="rgba(255,255,255,0.5)" style={authStyles.inputIcon} />
        <TextInput
          style={authStyles.input}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
        />
      </View>

      <View style={authStyles.inputWrap}>
        <Feather name="lock" size={16} color="rgba(255,255,255,0.5)" style={authStyles.inputIcon} />
        <TextInput
          style={[authStyles.input, { flex: 1 }]}
          placeholder="Password (min. 8 caratteri)"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          textContentType={section === "login" ? "password" : "newPassword"}
          autoCapitalize="none"
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
          <Feather name={showPassword ? "eye-off" : "eye"} size={16} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      {error && (
        <View style={authStyles.errorBox}>
          <Feather name="alert-circle" size={14} color="#FCA5A5" />
          <Text style={authStyles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [authStyles.submitBtn, pressed && { opacity: 0.9 }, loading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#2E6B50" />
        ) : (
          <Text style={authStyles.submitBtnText}>Conferma</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={[authStyles.screen, { paddingTop: 0, paddingBottom: insets.bottom }]}>
      <View style={authStyles.decoCircle1} />
      <View style={authStyles.decoCircle2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={authStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.logoSection}>
            <Image
              source={require("@/assets/images/leafy-logo-dark.png")}
              style={expanded ? authStyles.logoSmall : authStyles.logo}
              resizeMode="contain"
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Feather name="gift" size={16} color={Colors.primary} />
              <Text style={authStyles.tagline}>La tua spesa di ogni giorno,{"\n"}premiata.</Text>
            </View>
          </View>

          <View style={authStyles.actions}>
            {expanded !== "register" && (
              <Pressable
                style={({ pressed }) => [
                  authStyles.primaryBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => toggleSection("login")}
              >
                <Text style={authStyles.primaryBtnText}>Accedi</Text>
              </Pressable>
            )}

            {expanded === "login" && renderFormFields("login")}

            {expanded !== "login" && (
              <Pressable
                style={({ pressed }) => [
                  authStyles.outlineBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => toggleSection("register")}
              >
                <Text style={authStyles.outlineBtnText}>Crea account</Text>
              </Pressable>
            )}

            {expanded === "register" && renderFormFields("register")}

            <View style={authStyles.divider}>
              <View style={authStyles.dividerLine} />
              <Text style={authStyles.dividerText}>oppure</Text>
              <View style={authStyles.dividerLine} />
            </View>

            <Pressable onPress={() => {}} style={({ pressed }) => [authStyles.googleBtn, pressed && { opacity: 0.9 }]}>
              <GoogleIcon size={22} />
              <Text style={authStyles.googleBtnText}>Continua con Google</Text>
            </Pressable>

            <Pressable onPress={() => {}} style={({ pressed }) => [authStyles.fbBtn, pressed && { opacity: 0.9 }]}>
              <FacebookIcon size={22} />
              <Text style={authStyles.fbBtnText}>Continua con Facebook</Text>
            </Pressable>

            <Text style={authStyles.footer}>Ogni scelta sostenibile ti premia</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, mode } = useTheme();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: !!user,
  });

  const { data: impact, refetch: refetchImpact } = useQuery<{
    receiptsScanned: number;
    greenProductsCount: number;
    co2SavedKg: number;
  }>({
    queryKey: ["profile/impact"],
    queryFn: () => apiFetch("/profile/impact"),
    enabled: !!user,
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [streakToast, setStreakToast] = React.useState<{
    loginStreak: number;
    bonusAwarded: boolean;
    dropsBonus: number;
    bpPrize: { drops: number; lea: number } | null;
  } | null>(null);

  const [inStoreModeEnabled, setInStoreModeEnabled] = useState(true);
  const [inStoreModeActive, setInStoreModeActive] = useState(false);
  const [walkinToast, setWalkinToast] = useState<{ locationName: string; drops: number } | null>(null);
  const [showLeafyGoldModal, setShowLeafyGoldModal] = useState(false);
  const { pushEnabled } = useNotifications();

  const { locations, permissionStatus, loading: locationsLoading, refresh: refreshLocations } =
    useNearbyLocations(inStoreModeEnabled && !!user);

  const walkin = useWalkin(locations, pushEnabled);

  useEffect(() => {
    if (!user) return;
    if (inStoreModeEnabled) {
      walkin.startGeofenceWatch();
    } else {
      walkin.stopGeofenceWatch();
      walkin.reset();
      setInStoreModeActive(false);
    }
  }, [inStoreModeEnabled, user?.id]);

  useEffect(() => {
    if (!user || !inStoreModeEnabled) return;
    if (walkin.isInsideStore) {
      setInStoreModeActive(true);
    } else if (!walkin.isInsideStore && walkin.phase === "idle") {
      setInStoreModeActive(false);
    }
  }, [walkin.isInsideStore, walkin.phase, inStoreModeEnabled, user?.id]);

  useEffect(() => {
    if (walkin.phase === "rewarded" && walkin.result) {
      setWalkinToast({ locationName: walkin.result.locationName, drops: walkin.result.dropsAwarded });
      setTimeout(() => setWalkinToast(null), 4000);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      refetchProfile();
    }
  }, [walkin.phase]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) refetchProfile();
    }, [user?.id])
  );

  useEffect(() => {
    if (!user) return;
    apiFetch("/profile/daily-checkin", { method: "POST" }).then((data: DailyCheckinResponse) => {
      if (!data.alreadyCheckedIn) {
        setStreakToast({
          loginStreak: data.loginStreak,
          bonusAwarded: data.bonusAwarded,
          dropsBonus: data.dropsBonus,
          bpPrize: data.bpPrize ?? null,
        });
        setTimeout(() => setStreakToast(null), 4500);
        refetchProfile();
      }
    }).catch(() => {});
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchImpact()]);
    setRefreshing(false);
  };

  const scanButtonScale = useSharedValue(1);
  const scanAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanButtonScale.value }],
  }));

  const handleScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scanButtonScale.value = withSpring(0.95, {}, () => {
      scanButtonScale.value = withSpring(1);
    });
    router.push("/(tabs)/scan");
  };

  const topPadding = Platform.OS === "web" ? 67 : 0;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (profileLoading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding, backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.leaf} />
        <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: theme.textSecondary, textAlign: "center" }}>Caricamento...</Text>
      </View>
    );
  }

  const username = profile?.username || user?.firstName || "Utente";
  const streak = profile?.streak ?? 0;
  const loginStreak = profile?.loginStreak ?? 0;
  const hasLeafyGold = profile?.hasLeafyGold ?? false;
  const bpStreakDay = profile?.bpStreakDay ?? 0;
  const bpStreakClaimed = profile?.bpStreakClaimed ?? 0;
  const bpStreakCompleted = profile?.bpStreakCompleted ?? false;
  const drops = profile?.drops ?? profile?.totalPoints ?? 0;
  const leaBalance = profile?.leaBalance ?? 0;
  const points = drops;
  const level = profile?.level ?? "Germoglio";
  const levelProgress = Math.max(0, Math.min(100, profile?.levelProgress ?? 0));
  const nextLevelPoints = profile?.nextLevelPoints ?? 0;
  const safeInitial = (username.trim().charAt(0) || "U").toUpperCase();

  return (
    <View style={{ flex: 1 }}>
    {streakToast && (
      <Animated.View
        entering={FadeInDown.springify()}
        style={[streakStyles.toast, { top: topPadding + 12, backgroundColor: "#1A3028" }]}
      >
        <MaterialCommunityIcons
          name={streakToast.bonusAwarded ? "trophy" : streakToast.bpPrize ? "shield-star" : "fire"}
          size={22}
          color={streakToast.bonusAwarded ? "#FACC15" : streakToast.bpPrize ? "#A78BFA" : "#F97316"}
        />
        <View style={{ flex: 1 }}>
          <Text style={streakStyles.toastTitle}>
            {streakToast.bonusAwarded
              ? "Streak completata!"
              : streakToast.bpPrize
              ? "Leafy Gold — Premio!"
              : `Streak: giorno ${streakToast.loginStreak}`}
          </Text>
          {streakToast.bonusAwarded ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text style={streakStyles.toastSub}>7 giorni consecutivi! +{streakToast.dropsBonus}</Text>
              <XpIcon size={12} />
            </View>
          ) : streakToast.bpPrize ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
              {streakToast.bpPrize.drops > 0 && (
                <>
                  <Text style={streakStyles.toastSub}>+{streakToast.bpPrize.drops}</Text>
                  <XpIcon size={12} />
                </>
              )}
              {streakToast.bpPrize.lea > 0 && (
                <Text style={streakStyles.toastSub}>{streakToast.bpPrize.drops > 0 ? "  " : ""}+{streakToast.bpPrize.lea} $LEA</Text>
              )}
            </View>
          ) : (
            <Text style={streakStyles.toastSub}>
              {streakToast.loginStreak === 1
                ? "Ottimo inizio! Torna domani."
                : `${7 - streakToast.loginStreak} giorni al prossimo premio.`}
            </Text>
          )}
        </View>
      </Animated.View>
    )}
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }
    >
      {/* ── HERO SECTION ── */}
      <LinearGradient
        colors={mode === "dark" ? ["#142A20", "#0D1F16"] : ["#F2F9F5", "#E3F2EA"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.heroSection}
      >
        <View style={[styles.decoCircle1, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(46,107,80,0.07)" }]} />
        <View style={[styles.decoCircle2, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(46,107,80,0.05)" }]} />

        <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBoxHero}>
              <Image
                source={require("@/assets/leafy-icon-dark.png")}
                style={{ width: 40, height: 40 }}
                resizeMode="cover"
              />
            </View>
            <View>
              <Text style={[styles.greetingHero, { color: mode === "dark" ? "rgba(255,255,255,0.85)" : "#1A3028" }]}>Ciao, {username}! 👋</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/(tabs)/profilo")}>
              <View style={[styles.avatarCircleHero, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(46,107,80,0.12)", borderColor: mode === "dark" ? "rgba(255,255,255,0.35)" : "rgba(46,107,80,0.22)" }]}>
                <Text style={[styles.avatarInitial, { color: mode === "dark" ? "#fff" : "#2E6B50" }]}>{safeInitial}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.progressSection}
        >
          <LevelProgressRing
            progress={levelProgress}
            level={level}
            points={points}
            nextLevelPoints={nextLevelPoints}
          />
        </Animated.View>
      </LinearGradient>

      {/* ── STREAK CLASSICA ── */}
      <Animated.View entering={FadeInDown.delay(180).springify()} style={[streakStyles.card, { backgroundColor: "rgba(249,115,22,0.07)", borderLeftWidth: 4, borderLeftColor: "#F97316" }]}>
        <View style={streakStyles.cardHeader}>
          <MaterialCommunityIcons name="fire" size={22} color="#F97316" />
          <Text style={[streakStyles.cardTitle, { color: theme.text, fontSize: 15 }]}>Check In</Text>
          <Text style={[streakStyles.cardBadge, { color: theme.textSecondary }]}>Giorno {loginStreak}/7</Text>
        </View>
        <View style={streakStyles.dotsRow}>
          {Array.from({ length: 7 }, (_, i) => {
            const filled = i < loginStreak;
            return (
              <View
                key={i}
                style={[
                  streakStyles.dot,
                  filled
                    ? { backgroundColor: "#F97316" }
                    : { backgroundColor: theme.primaryLight, borderWidth: 1.5, borderColor: "rgba(249,115,22,0.25)" },
                ]}
              >
                <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: filled ? "#fff" : "rgba(249,115,22,0.45)" }}>{i + 1}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F97316", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, gap: 4 }}>
            <Text style={{ fontFamily: Fonts.bodyBold, color: "#ffffff", fontSize: 15 }}>250</Text>
            <LeaIcon size={14} />
          </View>
        </View>
      </Animated.View>

      {/* ── STREAK BATTLE PASS ── */}
      {hasLeafyGold && (
        <Animated.View entering={FadeInDown.delay(220).springify()} style={[streakStyles.card, { backgroundColor: "rgba(255,193,7,0.08)", borderLeftWidth: 4, borderLeftColor: "#FFD700" }]}>
          <View style={streakStyles.cardHeader}>
            <Image source={require("../../assets/images/leafy-gold-icon.png")} style={{ width: 22, height: 22 }} />
            <Text style={[streakStyles.cardTitle, { color: theme.text, fontSize: 15 }]}>Check In Gold</Text>
            {bpStreakCompleted
              ? <Text style={[streakStyles.cardBadge, { color: "#F59E0B" }]}>Completata ✓</Text>
              : <Text style={[streakStyles.cardBadge, { color: theme.textSecondary }]}>{bpStreakClaimed}/7 premi</Text>
            }
          </View>
          <View style={streakStyles.bpRow}>
            {BP_PRIZES_DISPLAY.map((prize, i) => {
              const claimed = i < bpStreakClaimed;
              const isDrops = prize.type === "drops" || prize.type === "both";
              const isLea = prize.type === "lea" || prize.type === "both";
              const dotColor = claimed
                ? (isLea && !isDrops ? "#FACC15" : "#A78BFA")
                : theme.primaryLight;
              return (
                <View key={i} style={streakStyles.bpSlot}>
                  <View style={[
                    streakStyles.bpDot,
                    { backgroundColor: dotColor },
                    !claimed && { borderWidth: 1.5, borderColor: "rgba(167,139,250,0.25)" },
                  ]}>
                    {claimed ? (
                      <MaterialCommunityIcons name="check" size={11} color="#fff" />
                    ) : prize.type === "both" ? (
                      <MaterialCommunityIcons name="star" size={11} color="rgba(167,139,250,0.5)" />
                    ) : isLea ? (
                      <LeaIcon size={16} />
                    ) : (
                      <XpIcon size={16} />
                    )}
                  </View>
                  <Text style={[streakStyles.bpLabel, { color: claimed ? (isLea && !isDrops ? "#FACC15" : "#A78BFA") : theme.textSecondary }]}>
                    {prize.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[streakStyles.cardHint, { color: theme.textSecondary }]}>
            {bpStreakCompleted
              ? "Ottimo lavoro! Il ciclo si azzera il 1° del mese."
              : bpStreakClaimed === 0
              ? "Fai check-in ogni giorno per sbloccare i premi"
              : `Streak attuale: ${bpStreakDay} ${bpStreakDay === 1 ? "giorno" : "giorni"} consecutivi`}
          </Text>
        </Animated.View>
      )}

      {/* ── BATTLE PASS CTA ── */}
      {!hasLeafyGold && (
        <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.bpCtaOuter}>
          <Pressable
            onPress={() => setShowLeafyGoldModal(true)}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={["#0a1f15", "#0f2a1e", "#1a3a28"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bpCtaCard}
            >
              {/* Gold accent top bar */}
              <LinearGradient
                colors={["#FFD700", "#FFA500", "#FFD700"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bpCtaAccentBar}
              />

              <View style={styles.bpCtaBody}>
                {/* Icon + texts */}
                <View style={styles.bpCtaLeft}>
                  <View style={styles.bpCtaIconWrap}>
                    <Image
                      source={require("@/assets/images/leafy-gold-icon.png")}
                      style={{ width: 48, height: 48 }}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bpCtaBadge}>BATTLE PASS</Text>
                    <Text style={styles.bpCtaTitle}>Passa a Premium</Text>
                    <Text style={styles.bpCtaSub}>Raddoppia i $LEA · 0,89€/mese</Text>
                  </View>
                </View>

                {/* CTA pill */}
                <LinearGradient
                  colors={["#FFD700", "#FFA500"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bpCtaPill}
                >
                  <Text style={styles.bpCtaPillText}>Attiva{"\n"}ora</Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
      <LeafyGoldModal
        visible={showLeafyGoldModal}
        onClose={() => {
          setShowLeafyGoldModal(false);
          refetchProfile();
        }}
      />

      {/* ── CTA ── */}
      <View style={styles.ctaSection}>
        <Animated.View style={scanAnimStyle}>
          <Pressable onPress={handleScanPress}>
            <LinearGradient
              colors={[theme.leaf, "#23533e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Feather name="camera" size={22} color="#fff" />
              <Text style={styles.ctaText}>Analizza la tua spesa</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Pressable
          style={[styles.challengeButton, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.push("/(tabs)/profilo?tab=sfide")}
        >
          <Feather name="zap" size={17} color={theme.leaf} />
          <Text style={[styles.challengeButtonText, { color: theme.leaf }]}>Vai alle sfide</Text>
          <Feather name="chevron-right" size={15} color={theme.leaf} />
        </Pressable>
      </View>

      {/* ── WALK-IN TOAST ── */}
      {walkinToast && (
        <Animated.View entering={FadeInDown.springify()} style={[inStoreStyles.walkinToast, { backgroundColor: "#1A3028" }]}>
          <MaterialCommunityIcons name="store-check" size={22} color="#51B888" />
          <View style={{ flex: 1 }}>
            <Text style={inStoreStyles.walkinToastTitle}>Walk-in completato!</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={inStoreStyles.walkinToastSub}>+{walkinToast.drops}</Text>
              <XpIcon size={13} />
              <Text style={inStoreStyles.walkinToastSub}> da {walkinToast.locationName}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── IN-STORE MODE ── */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 0 }}>
        <Pressable
          style={[inStoreStyles.toggleRow, { backgroundColor: theme.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setInStoreModeEnabled((prev) => !prev);
          }}
        >
          <MaterialCommunityIcons name="store-marker" size={20} color={inStoreModeEnabled ? theme.leaf : theme.textMuted} />
          <Text style={[inStoreStyles.toggleLabel, { color: inStoreModeEnabled ? theme.leaf : theme.text }]}>Rilevamento negozi</Text>
          <View style={[inStoreStyles.togglePill, { backgroundColor: inStoreModeEnabled ? theme.leaf : theme.border }]}>
            <View style={[inStoreStyles.toggleKnob, { transform: [{ translateX: inStoreModeEnabled ? 18 : 2 }] }]} />
          </View>
        </Pressable>

        {inStoreModeEnabled && inStoreModeActive && (
          <View style={[inStoreStyles.panel, { backgroundColor: theme.card }]}>
            {permissionStatus === "denied" && (
              <View style={inStoreStyles.permRow}>
                <Feather name="map-pin" size={16} color={theme.amber} />
                <Text style={[inStoreStyles.permText, { color: theme.textSecondary }]}>
                  Posizione non autorizzata. Abilita la posizione nelle impostazioni.
                </Text>
              </View>
            )}

            {permissionStatus === "granted" && locationsLoading && locations.length === 0 && (
              <View style={inStoreStyles.loadingRow}>
                <ActivityIndicator size="small" color={theme.leaf} />
                <Text style={[inStoreStyles.loadingText, { color: theme.textSecondary }]}>Ricerca negozi nelle vicinanze…</Text>
              </View>
            )}

            {permissionStatus === "granted" && !locationsLoading && locations.length === 0 && (
              <View style={inStoreStyles.emptyRow}>
                <MaterialCommunityIcons name="store-off" size={28} color={theme.textMuted} />
                <Text style={[inStoreStyles.emptyText, { color: theme.textSecondary }]}>Nessun negozio partner nelle vicinanze (300 m)</Text>
                <Pressable onPress={refreshLocations} style={[inStoreStyles.refreshBtn, { borderColor: theme.border }]}>
                  <Feather name="refresh-cw" size={13} color={theme.leaf} />
                  <Text style={[inStoreStyles.refreshBtnText, { color: theme.leaf }]}>Riprova</Text>
                </Pressable>
              </View>
            )}

            {permissionStatus === "granted" && locations.map((loc) => (
              <InStoreLocationCard
                key={loc.id}
                location={loc}
                walkin={walkin}
                theme={theme}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {/* ── IMPACT CARDS ── */}
      <Animated.View entering={FadeInDown.delay(340).springify()} style={styles.impactSection}>
        <Text style={[styles.impactTitle, { color: theme.text }]}>Il tuo impatto</Text>
        <View style={styles.impactRow}>
          <View style={[styles.impactCard, { backgroundColor: theme.card }]}>
            <Feather name="file-text" size={22} color={theme.leaf} />
            <Text style={[styles.impactCardValue, { color: theme.text }]}>{impact?.receiptsScanned ?? 0}</Text>
            <Text style={[styles.impactCardLabel, { color: theme.textSecondary }]}>Scontrini</Text>
          </View>
          <View style={[styles.impactCard, { backgroundColor: theme.card }]}>
            <Feather name="feather" size={22} color={theme.leaf} />
            <Text style={[styles.impactCardValue, { color: theme.text }]}>{impact?.greenProductsCount ?? 0}</Text>
            <Text style={[styles.impactCardLabel, { color: theme.textSecondary }]}>Prodotti green</Text>
          </View>
          <View style={[styles.impactCard, { backgroundColor: theme.card }]}>
            <Feather name="globe" size={22} color={theme.leaf} />
            <Text style={[styles.impactCardValue, { color: theme.text }]}>{(impact?.co2SavedKg ?? 0).toFixed(1)}</Text>
            <Text style={[styles.impactCardLabel, { color: theme.textSecondary }]}>kg CO₂</Text>
          </View>
        </View>
      </Animated.View>

    </ScrollView>
    </View>
  );
}

const DWELL_RING_SIZE = 96;
const DWELL_RING_STROKE = 8;
const DWELL_RING_RADIUS = (DWELL_RING_SIZE - DWELL_RING_STROKE) / 2;
const DWELL_RING_CX = DWELL_RING_SIZE / 2;
const DWELL_RING_CY = DWELL_RING_SIZE / 2;
const DWELL_CIRCUMFERENCE = 2 * Math.PI * DWELL_RING_RADIUS;

function DwellRing({
  remaining,
  total,
  color,
  onCancel,
  theme,
}: {
  remaining: number;
  total: number;
  color: string;
  onCancel: () => void;
  theme: import("@/constants/theme").ThemeColors;
}) {
  const fraction = remaining / total;
  const dashOffset = DWELL_CIRCUMFERENCE * fraction;
  return (
    <View style={inStoreStyles.dwellRingContainer}>
      <Svg width={DWELL_RING_SIZE} height={DWELL_RING_SIZE}>
        <Circle
          cx={DWELL_RING_CX}
          cy={DWELL_RING_CY}
          r={DWELL_RING_RADIUS}
          stroke={theme.border}
          strokeWidth={DWELL_RING_STROKE}
          fill="none"
        />
        <Circle
          cx={DWELL_RING_CX}
          cy={DWELL_RING_CY}
          r={DWELL_RING_RADIUS}
          stroke={color}
          strokeWidth={DWELL_RING_STROKE}
          fill="none"
          strokeDasharray={`${DWELL_CIRCUMFERENCE} ${DWELL_CIRCUMFERENCE}`}
          strokeDashoffset={DWELL_CIRCUMFERENCE - dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${DWELL_RING_CX} ${DWELL_RING_CY})`}
        />
      </Svg>
      <View style={inStoreStyles.dwellRingCenter}>
        <Text style={[inStoreStyles.dwellRingSeconds, { color }]}>{remaining}</Text>
        <Text style={[inStoreStyles.dwellRingLabel, { color: theme.textMuted }]}>sec</Text>
      </View>
      <Pressable style={[inStoreStyles.cancelBtn, { borderColor: theme.border, marginTop: 8, alignSelf: "center" }]} onPress={onCancel}>
        <Text style={[inStoreStyles.cancelBtnText, { color: theme.textMuted }]}>Annulla</Text>
      </Pressable>
    </View>
  );
}

function InStoreLocationCard({
  location,
  walkin,
  theme,
}: {
  location: NearbyLocation;
  walkin: ReturnType<typeof useWalkin>;
  theme: import("@/constants/theme").ThemeColors;
}) {
  const [clientCapReached, setClientCapReached] = useState(false);
  const checkDailyCapForLocation = walkin.checkDailyCapForLocation;

  useEffect(() => {
    checkDailyCapForLocation(location.id, location.walkinMaxPerDay, location.type).then(setClientCapReached).catch(() => {});
  }, [location.id, location.walkinMaxPerDay, location.type, walkin.phase, checkDailyCapForLocation]);

  const isActive = walkin.activeLocation?.id === location.id;
  const isStarting = isActive && walkin.phase === "starting";
  const isDwelling = isActive && walkin.phase === "dwelling";
  const isSubmitting = isActive && walkin.phase === "submitting";
  const isRewarded = isActive && walkin.phase === "rewarded";
  const isDone = (isActive && walkin.phase === "already_done") || (!isActive && clientCapReached);
  const isError = isActive && walkin.phase === "error";
  const isOasi = location.type === "oasi";

  const progressFraction = isDwelling
    ? 1 - walkin.dwellRemaining / walkin.dwellTotal
    : isRewarded || isDone
    ? 1
    : 0;

  return (
    <View style={[inStoreStyles.locationCard, { borderColor: isOasi ? "#A78BFA" : theme.border, borderWidth: isOasi ? 1.5 : 1 }]}>
      <View style={inStoreStyles.locationHeader}>
        <View style={{ flex: 1 }}>
          <View style={inStoreStyles.locationNameRow}>
            {isOasi && (
              <View style={inStoreStyles.oasiBadge}>
                <Text style={inStoreStyles.oasiBadgeText}>OASI</Text>
              </View>
            )}
            <Text style={[inStoreStyles.locationName, { color: theme.text }]}>{location.name}</Text>
          </View>
          <Text style={[inStoreStyles.locationDist, { color: theme.textMuted }]}>
            {location.distanceM < 50
              ? "Sei qui!"
              : location.distanceM < 1000
              ? `${Math.round(location.distanceM)} m di distanza`
              : `${(location.distanceM / 1000).toFixed(1)} km di distanza`}
          </Text>
          <Text style={[inStoreStyles.locationCap, { color: theme.textMuted }]}>
            {`Max ${location.walkinMaxPerDay}x al giorno · ${location.walkinDrops} drops`}
          </Text>
        </View>
        <View style={[inStoreStyles.dropsBubble, { backgroundColor: isOasi ? "rgba(167,139,250,0.12)" : theme.primaryLight, flexDirection: "row", alignItems: "center", gap: 3 }]}>
          <Text style={[inStoreStyles.dropsBubbleText, { color: isOasi ? "#7C3AED" : theme.leaf }]}>
            +{location.walkinDrops}
          </Text>
          <XpIcon size={16} />
        </View>
      </View>

      {isDwelling && (
        <DwellRing
          remaining={walkin.dwellRemaining}
          total={walkin.dwellTotal}
          color={isOasi ? "#7C3AED" : theme.leaf}
          onCancel={walkin.cancelDwell}
          theme={theme}
        />
      )}

      {(isRewarded || isDone) && (
        <View style={[inStoreStyles.rewardRow, { backgroundColor: isRewarded ? "rgba(81,184,136,0.12)" : theme.primaryLight }]}>
          <MaterialCommunityIcons
            name={isRewarded ? "check-circle" : "clock-check-outline"}
            size={16}
            color={isRewarded ? "#51B888" : theme.textMuted}
          />
          {isRewarded ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text style={[inStoreStyles.rewardText, { color: "#51B888" }]}>
                {`+${walkin.result?.dropsAwarded}`}
              </Text>
              <XpIcon size={13} />
              <Text style={[inStoreStyles.rewardText, { color: "#51B888" }]}> guadagnati!</Text>
            </View>
          ) : (
            <Text style={[inStoreStyles.rewardText, { color: theme.textMuted }]}>Già completato oggi</Text>
          )}
        </View>
      )}

      {isActive && location.challenges.length > 0 && isDwelling && (
        <View style={inStoreStyles.challengesSection}>
          <Text style={[inStoreStyles.challengesTitle, { color: theme.textSecondary }]}>Sfide in negozio</Text>
          {location.challenges.map((ch) => (
            <Pressable
              key={ch.id}
              style={[inStoreStyles.challengeRow, { backgroundColor: theme.primaryLight }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/barcode-scanner",
                  params: { mode: "discovery", locationId: String(location.id), challengeId: String(ch.id), productName: ch.name },
                });
              }}
            >
              <MaterialCommunityIcons name="barcode-scan" size={16} color={theme.leaf} />
              <View style={{ flex: 1 }}>
                <Text style={[inStoreStyles.challengeName, { color: theme.text }]}>{ch.name}</Text>
                {ch.description && (
                  <Text style={[inStoreStyles.challengeDesc, { color: theme.textMuted }]}>{ch.description}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Text style={[inStoreStyles.challengeDrops, { color: theme.leaf }]}>+{ch.dropsReward}</Text>
                <XpIcon size={14} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!isDwelling && !isActive && location.challenges.length > 0 && (
        <View style={inStoreStyles.challengesSection}>
          <Text style={[inStoreStyles.challengesTitle, { color: theme.textSecondary }]}>Sfide disponibili</Text>
          {location.challenges.map((ch) => (
            <View key={ch.id} style={[inStoreStyles.challengeRow, { backgroundColor: theme.primaryLight, opacity: 0.55 }]}>
              <MaterialCommunityIcons name="barcode-scan" size={16} color={theme.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[inStoreStyles.challengeName, { color: theme.textMuted }]}>{ch.name}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Text style={[inStoreStyles.challengeDrops, { color: theme.textMuted }]}>+{ch.dropsReward}</Text>
                <XpIcon size={14} />
              </View>
            </View>
          ))}
          <Text style={[inStoreStyles.challengeHint, { color: theme.textMuted }]}>Entra nel negozio per sbloccare le sfide</Text>
        </View>
      )}

      {isError && (
        <View style={inStoreStyles.submittingRow}>
          <Feather name="alert-circle" size={14} color={theme.amber} />
          <Text style={[inStoreStyles.submittingText, { color: theme.amber }]}>{walkin.errorMsg ?? "Errore"}</Text>
          <Pressable onPress={walkin.reset}>
            <Text style={{ color: theme.leaf, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Riprova</Text>
          </Pressable>
        </View>
      )}

      {!isStarting && !isDwelling && !isSubmitting && !isRewarded && !isDone && !isError && (
        <Pressable
          style={[inStoreStyles.enterBtn, { backgroundColor: isOasi ? "#7C3AED" : theme.leaf }]}
          onPress={() => walkin.enterStore(location)}
        >
          <MaterialCommunityIcons name="store-check" size={16} color="#fff" />
          <Text style={inStoreStyles.enterBtnText}>Sono qui — inizia rilevamento</Text>
        </Pressable>
      )}

      {(isStarting || isSubmitting) && (
        <View style={inStoreStyles.submittingRow}>
          <ActivityIndicator size="small" color={theme.leaf} />
          <Text style={[inStoreStyles.submittingText, { color: theme.textSecondary }]}>
            {isStarting ? "Avvio sessione…" : "Registrazione walk-in…"}
          </Text>
        </View>
      )}
    </View>
  );
}

const inStoreStyles = StyleSheet.create({
  walkinToast: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  walkinToastTitle: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
  },
  walkinToastSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },
  togglePill: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  panel: {
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  permText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyRow: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  refreshBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  locationCard: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: "transparent",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  locationNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  oasiBadge: {
    backgroundColor: "#7C3AED",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  oasiBadgeText: {
    fontSize: 9,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  locationName: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
  },
  locationDist: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  locationCap: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    opacity: 0.65,
  },
  dropsBubble: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dropsBubbleText: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
  },
  dwellRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dwellBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  dwellFill: {
    height: 6,
    borderRadius: 3,
  },
  dwellTimer: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    minWidth: 32,
    textAlign: "right",
  },
  dwellRingContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dwellRingCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: DWELL_RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  dwellRingSeconds: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
  },
  dwellRingLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: -2,
  },
  challengeHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 6,
    opacity: 0.7,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  rewardText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  challengesSection: {
    gap: 6,
  },
  challengesTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  challengeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  challengeName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  challengeDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  challengeDrops: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
  },
  enterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  enterBtnText: {
    fontSize: 14,
    fontFamily: "DMSans_600SemiBold",
    color: "#fff",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 8,
  },
  submittingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});

const streakStyles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastTitle: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
  },
  toastSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    flex: 1,
  },
  cardBadge: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 15,
  },
  bpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  bpSlot: {
    alignItems: "center",
    gap: 3,
    flex: 1,
  },
  bpDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  bpLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    textAlign: "center",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 32,
  },

  heroSection: {
    overflow: "hidden",
    paddingBottom: 32,
  },
  decoCircle1: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  decoCircle2: {
    position: "absolute",
    bottom: 20,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBoxHero: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoTextHero: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: "#ffffff",
    marginBottom: 2,
  },
  greetingHero: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dropsBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
  },
  dropsBadgeValue: {
    fontSize: 13,
    fontFamily: "DMSans_700Bold",
    color: "#ffffff",
  },
  dropsBadgeSymbol: {
    fontSize: 10,
    fontFamily: "DMSans_700Bold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  leaBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  leaBadgeSymbol: {
    fontSize: 10,
    fontFamily: "DMSans_700Bold",
    color: "#AADF2A",
    letterSpacing: 0.5,
  },
  leaBadgeValue: {
    fontSize: 14,
    fontFamily: "DMSans_700Bold",
    color: "#ffffff",
  },
  avatarCircleHero: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarInitial: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  progressSection: {
    alignItems: "center",
    paddingVertical: 8,
  },

  impactSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  impactTitle: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginBottom: 12,
  },
  impactRow: {
    flexDirection: "row",
    gap: 10,
  },
  impactCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  impactCardValue: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  impactCardLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  bpCtaOuter: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 0,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
    borderRadius: 18,
  },
  bpCtaCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    overflow: "hidden",
  },
  bpCtaAccentBar: {
    height: 3,
    opacity: 0.9,
  },
  bpCtaBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  bpCtaLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bpCtaIconWrap: {
    borderRadius: 22,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  bpCtaBadge: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    letterSpacing: 2.5,
    marginBottom: 2,
    opacity: 0.85,
  },
  bpCtaTitle: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    marginBottom: 2,
  },
  bpCtaSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
  },
  bpCtaPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
  },
  bpCtaPillText: {
    fontSize: 12,
    fontFamily: "DMSans_700Bold",
    color: "#1a3a28",
    textAlign: "center",
    lineHeight: 16,
  },
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 64,
    borderRadius: 24,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
  },
  challengeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "rgba(46,107,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(46,107,80,0.18)",
  },
  challengeButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.leaf,
  },
});

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#2E6B50",
    overflow: "hidden",
  },
  decoCircle1: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  decoCircle2: {
    position: "absolute",
    bottom: -40,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logo: {
    width: SCREEN_WIDTH * 0.7,
    height: 140,
    marginBottom: 4,
  },
  logoSmall: {
    width: SCREEN_WIDTH * 0.45,
    height: 80,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 48,
  },
  actions: {
    width: "100%",
    paddingHorizontal: 32,
    paddingBottom: 20,
    alignItems: "center",
    gap: 10,
  },
  primaryBtn: {
    width: "100%",
    maxWidth: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  btnActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  btnActiveText: {
    color: "#FFFFFF",
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "DMSans_700Bold",
    color: "#2E6B50",
    letterSpacing: 0.3,
  },
  outlineBtn: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  outlineBtnActive: {
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  outlineBtnText: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: "#FFFFFF",
  },
  accordionBody: {
    width: "100%",
    maxWidth: 280,
    gap: 10,
    paddingTop: 4,
    paddingBottom: 6,
    overflow: "hidden" as const,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    maxWidth: 280,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  googleBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#3C4043",
  },
  fbBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    maxWidth: 280,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "#1877F2",
    shadowColor: "#1877F2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  fbBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  footer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginTop: 8,
    textAlign: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  inputIcon: {
    width: 18,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(220,38,38,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#FCA5A5",
    flex: 1,
  },
  submitBtn: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
    color: "#2E6B50",
    letterSpacing: 0.2,
  },
});
