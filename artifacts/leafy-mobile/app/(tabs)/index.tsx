import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleIcon } from "../../components/GoogleIcon";
import { FacebookIcon } from "../../components/FacebookIcon";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import Svg, { Circle, Path, Defs, ClipPath, Rect, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import type { Profile } from "@workspace/api-client-react";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LEVEL_LABELS: Record<string, string> = {
  Germoglio: "Germoglio",
  Ramoscello: "Ramoscello",
  Arbusto: "Arbusto",
  Albero: "Albero",
  Foresta: "Foresta",
};

const LEVEL_CONFIG = [
  { name: "Germoglio", emoji: "🌱", minPts: 500, color: "#8BC34A", fruitColor: "#8BC34A", nodeSize: 26, imgSize: 26 },
  { name: "Ramoscello", emoji: "🌿", minPts: 1500, color: "#66BB6A", fruitColor: "#8BC34A", nodeSize: 36, imgSize: 36 },
  { name: "Arbusto", emoji: "🍃", minPts: 5000, color: "#43A047", fruitColor: "#F4D03F", nodeSize: 48, imgSize: 48 },
  { name: "Albero", emoji: "🌳", minPts: 10000, color: "#2E7D32", fruitColor: "#FF8C42", nodeSize: 62, imgSize: 62 },
  { name: "Foresta", emoji: "🌲", minPts: 25000, color: "#1B5E20", fruitColor: "#E74C3C", nodeSize: 78, imgSize: 78 },
];

const SEGMENT_COLORS = [
  "#AADF2A",
  "#FFD600",
  "#FF6D00",
  "#F53B3B",
];

const LEVEL_BADGE_IMAGES: Record<string, ImageSourcePropType> = {
  Germoglio: require("@/assets/badges/level-germoglio.png"),
  Ramoscello: require("@/assets/badges/level-ramoscello.png"),
  Arbusto: require("@/assets/badges/level-arbusto.png"),
  Albero: require("@/assets/badges/level-albero.png"),
  Foresta: require("@/assets/badges/level-foresta.png"),
};

const BAR_PADDING_H = 16;
const LABEL_HEIGHT = 16;
const BAR_TOP_FACTOR = 1.6;
const BAR_EXTRA = 10;
const MAX_RADIUS = Math.max(...LEVEL_CONFIG.map(l => l.nodeSize / 2));
const BASELINE_Y = MAX_RADIUS * 2;
const BAR_TOTAL_H = BASELINE_Y + LABEL_HEIGHT + 10;

function LevelMilestoneBar({ currentLevel, points }: { currentLevel: string; points: number }) {
  const [expandedBadge, setExpandedBadge] = useState<number | null>(null);
  const currentIdx = LEVEL_CONFIG.findIndex((l) => l.name === currentLevel);
  const safeIdx = currentIdx >= 0 ? currentIdx : 0;
  const screenW = Dimensions.get("window").width;
  const barWidth = screenW - BAR_PADDING_H * 2;

  const r0 = LEVEL_CONFIG[0].nodeSize / 2;
  const rLast = LEVEL_CONFIG[LEVEL_CONFIG.length - 1].nodeSize / 2;

  const nodes = LEVEL_CONFIG.map((lvl, i) => {
    const r = lvl.nodeSize / 2;
    const cx = r0 + (barWidth - r0 - rLast) * i / (LEVEL_CONFIG.length - 1);
    const cy = BASELINE_Y - r;
    return { cx, cy, r, lvl };
  });

  const xStart = -BAR_EXTRA;
  const xEnd = barWidth + BAR_EXTRA;
  const topYStart = BASELINE_Y - nodes[0].r * BAR_TOP_FACTOR;
  const topYEnd = BASELINE_Y - nodes[nodes.length - 1].r * BAR_TOP_FACTOR;
  const bWidth = xEnd - xStart;
  const cp1x = xStart + bWidth * 0.80;
  const cp2x = xEnd - bWidth * 0.05;
  const fullBarPath = `M ${xStart},${topYStart} C ${cp1x},${topYStart} ${cp2x},${topYEnd} ${xEnd},${topYEnd} L ${xEnd},${BASELINE_Y} L ${xStart},${BASELINE_Y} Z`;
  const topCurvePath = `M ${xStart},${topYStart} C ${cp1x},${topYStart} ${cp2x},${topYEnd} ${xEnd},${topYEnd}`;

  const isMaxLevel = safeIdx >= LEVEL_CONFIG.length - 1;
  let fillPct = 0;
  let progressX = xStart;
  if (isMaxLevel) {
    fillPct = 1;
    progressX = xEnd;
  } else {
    const curr = LEVEL_CONFIG[safeIdx];
    const next = LEVEL_CONFIG[safeIdx + 1];
    const range = next.minPts - curr.minPts;
    fillPct = Math.min(1, Math.max(0, (points - curr.minPts) / range));
    progressX = nodes[safeIdx].cx + (nodes[safeIdx + 1].cx - nodes[safeIdx].cx) * fillPct;
  }
  const pointsRemaining = isMaxLevel ? 0 : Math.max(0, LEVEL_CONFIG[safeIdx + 1].minPts - points);

  const gradientStops = [
    { offset: "0%", color: SEGMENT_COLORS[0] },
    { offset: `${(nodes[1].cx / barWidth) * 100}%`, color: SEGMENT_COLORS[1] },
    { offset: `${(nodes[2].cx / barWidth) * 100}%`, color: SEGMENT_COLORS[2] },
    { offset: `${(nodes[3].cx / barWidth) * 100}%`, color: SEGMENT_COLORS[3] },
    { offset: "100%", color: SEGMENT_COLORS[3] },
  ];

  return (
    <View style={milestoneStyles.container}>
      <View style={{ width: barWidth, height: BAR_TOTAL_H, position: "relative", overflow: "visible", elevation: 0, zIndex: 0 }}>
        <Svg width={barWidth + BAR_EXTRA * 2} height={BAR_TOTAL_H} style={{ position: "absolute", top: 0, left: -BAR_EXTRA }}>
          <Defs>
            <SvgLinearGradient id="barGrad" x1={0} y1={0} x2={barWidth} y2={0} gradientUnits="userSpaceOnUse">
              {gradientStops.map((s, i) => (
                <Stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </SvgLinearGradient>
            <ClipPath id="progressClip">
              <Rect x={xStart} y={0} width={progressX - xStart} height={BAR_TOTAL_H} />
            </ClipPath>
          </Defs>
          <Path d={fullBarPath} fill="rgba(255,255,255,0.28)" />
          <Path d={fullBarPath} fill="url(#barGrad)" clipPath="url(#progressClip)" />
          {progressX > nodes[0].cx && safeIdx < LEVEL_CONFIG.length - 1 && (
            <Circle cx={progressX} cy={BASELINE_Y} r={5} fill="rgba(255,255,255,0.85)" />
          )}
        </Svg>
      </View>

      <View style={{ position: "absolute", top: 4, left: BAR_PADDING_H, width: barWidth, height: BAR_TOTAL_H, zIndex: 100, overflow: "visible", elevation: 50 }}>
        {nodes.map(({ cx, cy, r, lvl }, i) => {
          const reached = safeIdx >= i;
          const isCurrent = i === safeIdx;
          const isLast = i === LEVEL_CONFIG.length - 1;
          const sz = lvl.nodeSize;
          const segColor = SEGMENT_COLORS[Math.min(i, SEGMENT_COLORS.length - 1)];
          const labelW = 80;
          const rawLeft = cx - labelW / 2;
          const clampedLeft = Math.max(0, Math.min(rawLeft, barWidth - labelW));
          const chevronH = isCurrent ? 10 : 0;
          const ringGap = 4;
          const ringR = sz / 2 + ringGap;
          const ringSize = sz + ringGap * 2;
          const circumference = 2 * Math.PI * ringR;

          const toggleExpand = () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedBadge(expandedBadge === i ? null : i);
          };

          return (
            <TouchableOpacity key={i} onPress={toggleExpand} activeOpacity={0.7} style={{ position: "absolute", left: clampedLeft, top: cy - r - chevronH, width: labelW, alignItems: "center" }}>
              {isCurrent && (
                <Svg width={10} height={6} style={{ marginBottom: 4 }}>
                  <Path d="M 0,0 L 5,6 L 10,0 Z" fill="white" />
                </Svg>
              )}

              <View style={{ position: "relative", width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
                <View
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: reached ? 7 : 2 },
                    shadowOpacity: reached ? 0.72 : 0.15,
                    shadowRadius: reached ? 14 : 3,
                    elevation: reached ? 20 : 3,
                  }}
                >
                  <Image
                    source={LEVEL_BADGE_IMAGES[lvl.name]}
                    style={{ width: sz, height: sz, opacity: reached ? 1 : 0.55 }}
                    resizeMode="contain"
                  />
                </View>

                {((isCurrent && !isLast) || !reached) && (
                  <Svg width={ringSize} height={ringSize} style={{ position: "absolute", top: 0, left: 0 }}>
                    <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="rgba(255,255,255,0.15)" strokeWidth={3} fill="none" />
                    {isCurrent && !isLast && (
                      <Circle
                        cx={ringSize / 2} cy={ringSize / 2} r={ringR}
                        stroke={segColor} strokeWidth={3} fill="none"
                        strokeDasharray={`${circumference}`}
                        strokeDashoffset={`${circumference * (1 - fillPct)}`}
                        strokeLinecap="round"
                        transform={`rotate(-90, ${ringSize / 2}, ${ringSize / 2})`}
                      />
                    )}
                  </Svg>
                )}

                {!reached && (
                  <Text style={{ position: "absolute", bottom: 0, right: 0, fontSize: 10 }}>🔒</Text>
                )}
              </View>

              <View style={{ width: sz * 0.8, height: 5, borderRadius: 3, backgroundColor: reached ? segColor : "rgba(255,255,255,0.18)", marginTop: 2 }} />

              <Text style={{ fontSize: 8, fontFamily: "Inter_500Medium", color: reached ? "#fff" : "rgba(255,255,255,0.45)", marginTop: 2 }} numberOfLines={1}>
                {lvl.minPts.toLocaleString("it-IT")} pt
              </Text>

              {isCurrent && !isLast && (
                <Text style={{ fontSize: 7, fontFamily: "Inter_500Medium", color: segColor, marginTop: 1 }} numberOfLines={1}>
                  – {pointsRemaining.toLocaleString("it-IT")} pt
                </Text>
              )}

              <Text
                style={[milestoneStyles.nodeLabel, reached && { color: "#fff" }]}
                numberOfLines={1}
              >
                {lvl.name}
              </Text>

              {expandedBadge === i && (
                <View style={{ backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, padding: 8, marginTop: 4, width: labelW }}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11, textAlign: "center" }}>{lvl.name}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, textAlign: "center", marginTop: 2 }}>{lvl.minPts.toLocaleString("it-IT")} pt</Text>
                  <Text style={{ color: reached ? "#AADF2A" : "rgba(255,255,255,0.5)", fontSize: 9, textAlign: "center", marginTop: 2, fontFamily: "Inter_500Medium" }}>
                    {reached ? "✓ Sbloccato" : `Mancano ${Math.max(0, lvl.minPts - points).toLocaleString("it-IT")} pt`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const milestoneStyles = StyleSheet.create({
  container: {
    paddingHorizontal: BAR_PADDING_H,
    paddingTop: 4,
    paddingBottom: 4,
    overflow: "visible",
  },
  nodeLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 2,
  },
});

const MOTIVATIONAL_MESSAGES = [
  (name: string) => `Oggi sei già un passo avanti, ${name}!`,
  (name: string) => `Stai accumulando punti reali, ${name}!`,
  () => `Ogni scontrino vale qualcosa per te.`,
  (name: string) => `Grande slancio questa settimana, ${name}!`,
  (_name: string, pts: number) => `${pts.toLocaleString("it-IT")} punti nel tuo portafoglio — continua così!`,
  () => `Potresti sorprenderti di quanti punti guadagni già.`,
  () => `Ogni scelta conta. La tua fa la differenza!`,
];

const RING_SIZE = 220;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = RING_RADIUS * 2 * Math.PI;

function LevelProgressRing({
  progress,
  level,
  points,
  heroMode = false,
}: {
  progress: number;
  level: string;
  points: number;
  heroMode?: boolean;
}) {
  const animatedProgress = useSharedValue(0);
  const scale = useSharedValue(0.82);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 1600 });
    scale.value = withSpring(1, { damping: 14, stiffness: 90 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => {
    const offset = RING_CIRCUMFERENCE - (animatedProgress.value / 100) * RING_CIRCUMFERENCE;
    return { strokeDashoffset: offset };
  });

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const trackColor = heroMode ? "rgba(255,255,255,0.22)" : Colors.border;
  const fillColor = heroMode ? "#ffffff" : Colors.leaf;
  const labelColor = heroMode ? "rgba(255,255,255,0.7)" : Colors.textSecondary;
  const valueColor = heroMode ? "#ffffff" : Colors.leaf;

  return (
    <Animated.View style={[ringStyles.container, containerAnimStyle]}>
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={trackColor}
          strokeWidth={RING_STROKE}
          fill="transparent"
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={fillColor}
          strokeWidth={RING_STROKE}
          fill="transparent"
          strokeDasharray={RING_CIRCUMFERENCE}
          animatedProps={animatedProps}
          strokeLinecap="round"
        />
      </Svg>
      <View style={ringStyles.innerContent}>
        <Text style={[ringStyles.levelLabel, { color: labelColor }]}>
          {(LEVEL_LABELS[level] ?? level).toUpperCase()}
        </Text>
        <Image
          source={LEVEL_BADGE_IMAGES[level] ?? LEVEL_BADGE_IMAGES.Germoglio}
          style={{ width: 64, height: 64, marginVertical: 4 }}
          resizeMode="contain"
        />
        <Text style={[ringStyles.pointsValue, { color: valueColor }]}>
          {new Intl.NumberFormat("it-IT").format(points)}
        </Text>
        <Text style={[ringStyles.pointsLabel, { color: labelColor }]}>PUNTI</Text>
      </View>
    </Animated.View>
  );
}

const ringStyles = StyleSheet.create({
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
  },
  levelLabel: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 34,
    fontFamily: "DMSans_700Bold",
    color: Colors.leaf,
    letterSpacing: -1,
  },
  pointsLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 2,
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
    <View style={[authStyles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
            <Text style={authStyles.tagline}>
              🎁 La tua spesa di ogni giorno,{"\n"}premiata.
            </Text>
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

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  if (!user) {
    return (
      <GuestAuthScreen />
    );
  }

  if (profileLoading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.leaf} />
        <Text style={{ marginTop: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" }}>Caricamento...</Text>
      </View>
    );
  }

  const username = profile?.username || user?.firstName || "Utente";
  const streak = profile?.streak ?? 0;
  const points = profile?.totalPoints ?? 0;
  const level = profile?.level ?? "Germoglio";
  const levelProgress = Math.max(0, Math.min(100, profile?.levelProgress ?? 0));
  const nextLevelPoints = profile?.nextLevelPoints ?? 0;
  const safeInitial = (username.trim().charAt(0) || "U").toUpperCase();

  const msgFn = MOTIVATIONAL_MESSAGES[streak % MOTIVATIONAL_MESSAGES.length];
  const motivationalMessage = msgFn(username, points);

  return (
    <ScrollView
      style={styles.container}
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
        colors={["#2E6B50", "#1a4a35"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.decoCircle1} />
        <View style={styles.decoCircle2} />

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
              <Text style={styles.greetingHero}>Ciao, {username}! 👋</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/profilo")}>
            <View style={styles.avatarCircleHero}>
              <Text style={styles.avatarInitial}>{safeInitial}</Text>
            </View>
          </Pressable>
        </View>

        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.progressSection}
        >
          <LevelProgressRing
            progress={levelProgress}
            level={level}
            points={points}
            heroMode
          />

          <LevelMilestoneBar currentLevel={level} points={points} />
        </Animated.View>
      </LinearGradient>

      {/* ── STREAK CARD ── */}
      <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.streakCard}>
        <View style={styles.streakCardLeft}>
          <View style={styles.streakIconWrap}>
            <MaterialCommunityIcons name="fire" size={30} color="#F97316" />
          </View>
          <View>
            <Text style={styles.streakCardValue}>{streak}</Text>
            <Text style={styles.streakCardSubLabel}>giorni di fila</Text>
          </View>
        </View>
        <Text style={styles.streakCardMsg}>
          {streak === 0
            ? "Inizia il tuo streak!"
            : streak === 1
            ? "Ottimo inizio!"
            : `Super combo x${streak}!`}
        </Text>
      </Animated.View>

      {/* ── MOTIVATIONAL ── */}
      <Animated.View
        entering={FadeInDown.delay(260).springify()}
        style={styles.motivationalBox}
      >
        <View style={styles.motivationalRow}>
          <MaterialCommunityIcons name="leaf" size={16} color={Colors.leaf} />
          <Text style={styles.motivationalText}>{motivationalMessage}</Text>
        </View>
      </Animated.View>

      {/* ── CTA ── */}
      <View style={styles.ctaSection}>
        <Animated.View style={scanAnimStyle}>
          <Pressable onPress={handleScanPress}>
            <LinearGradient
              colors={[Colors.leaf, "#23533e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Feather name="camera" size={22} color="#fff" />
              <Text style={styles.ctaText}>Analizza la tua spesa</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* ── IMPACT CARDS ── */}
      <Animated.View entering={FadeInDown.delay(340).springify()} style={styles.impactSection}>
        <Text style={styles.impactTitle}>Il tuo impatto</Text>
        <View style={styles.impactRow}>
          <View style={styles.impactCard}>
            <Text style={styles.impactEmoji}>🧾</Text>
            <Text style={styles.impactCardValue}>{impact?.receiptsScanned ?? 0}</Text>
            <Text style={styles.impactCardLabel}>Scontrini</Text>
          </View>
          <View style={styles.impactCard}>
            <Text style={styles.impactEmoji}>🌿</Text>
            <Text style={styles.impactCardValue}>{impact?.greenProductsCount ?? 0}</Text>
            <Text style={styles.impactCardLabel}>Prodotti green</Text>
          </View>
          <View style={styles.impactCard}>
            <Text style={styles.impactEmoji}>🌍</Text>
            <Text style={styles.impactCardValue}>{(impact?.co2SavedKg ?? 0).toFixed(1)}</Text>
            <Text style={styles.impactCardLabel}>kg CO₂</Text>
          </View>
        </View>
      </Animated.View>

    </ScrollView>
  );
}

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
  progressBarSection: {
    width: "100%",
    maxWidth: 280,
    marginTop: 20,
  },
  progressBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressBarLabelHero: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  progressBarTrackHero: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFillHero: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },

  streakCard: {
    marginHorizontal: 20,
    marginTop: -16,
    marginBottom: 4,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  streakCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  streakIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  streakCardValue: {
    fontSize: 26,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    lineHeight: 30,
  },
  streakCardSubLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  streakCardMsg: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#F97316",
    maxWidth: 110,
    textAlign: "right",
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
  impactEmoji: {
    fontSize: 24,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.leaf,
  },
  motivationalBox: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(46, 107, 80, 0.15)",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  motivationalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  motivationalText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.leaf,
    textAlign: "center",
    lineHeight: 22,
    flex: 1,
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
