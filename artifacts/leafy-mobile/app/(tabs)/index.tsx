import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import type { Profile, ImpactStats, Challenge } from "@workspace/api-client-react";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LEVEL_LABELS: Record<string, string> = {
  Bronzo: "Bronzo",
  Argento: "Argento",
  Oro: "Oro",
  Platino: "Platino",
  bronze: "Bronzo",
  silver: "Argento",
  gold: "Oro",
  platinum: "Platino",
};

const MOTIVATIONAL_MESSAGES = [
  (name: string) => `Oggi sei già un passo avanti, ${name}! 🌿`,
  (name: string) => `Stai accumulando punti reali, ${name}! 🏆`,
  () => `Ogni scontrino vale qualcosa per te. 💫`,
  (name: string) => `Grande slancio questa settimana, ${name}! ♻️`,
  (_name: string, pts: number) => `${pts.toLocaleString("it-IT")} punti nel tuo portafoglio — continua così! 🎁`,
  () => `Potresti sorprenderti di quanti punti guadagni già. 🛒`,
  () => `Ogni scelta conta. La tua fa la differenza! 🌱`,
];

const RING_SIZE = 220;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = RING_RADIUS * 2 * Math.PI;

function LevelProgressRing({
  progress,
  level,
  points,
  percentage,
}: {
  progress: number;
  level: string;
  points: number;
  percentage: number;
}) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 1500 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => {
    const offset = RING_CIRCUMFERENCE - (animatedProgress.value / 100) * RING_CIRCUMFERENCE;
    return {
      strokeDashoffset: offset,
    };
  });

  return (
    <View style={ringStyles.container}>
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={Colors.border}
          strokeWidth={RING_STROKE}
          fill="transparent"
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={Colors.leaf}
          strokeWidth={RING_STROKE}
          fill="transparent"
          strokeDasharray={RING_CIRCUMFERENCE}
          animatedProps={animatedProps}
          strokeLinecap="round"
        />
      </Svg>
      <View style={ringStyles.innerContent}>
        <Text style={ringStyles.levelLabel}>
          {(LEVEL_LABELS[level] ?? level).toUpperCase()}
        </Text>
        <Text style={ringStyles.percentageText}>{Math.round(percentage)}%</Text>
        <Text style={ringStyles.pointsValue}>
          {new Intl.NumberFormat("it-IT").format(points)}
        </Text>
        <Text style={ringStyles.pointsLabel}>PUNTI</Text>
      </View>
    </View>
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
  percentageText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  pointsValue: {
    fontSize: 32,
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

function ImpactCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.impactCard}>
      <View style={styles.impactIcon}>
        <Feather name={icon} size={20} color={Colors.leaf} />
      </View>
      <Text style={styles.impactValue}>{value.toFixed(1)}</Text>
      <Text style={styles.impactUnit}>{unit}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </Animated.View>
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

  const { data: impact, refetch: refetchImpact } = useQuery<ImpactStats>({
    queryKey: ["impact"],
    queryFn: () => apiFetch("/profile/impact"),
    enabled: !!user,
  });

  const { data: challenges } = useQuery<Challenge[]>({
    queryKey: ["challenges"],
    queryFn: () => apiFetch("/challenges"),
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
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <MaterialCommunityIcons name="leaf" size={48} color={Colors.primaryMuted} />
        <Text style={styles.guestTitle}>Benvenuto su Leafy</Text>
        <Text style={styles.guestSub}>
          Accedi per iniziare a guadagnare punti green
        </Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  if (profileLoading) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.leaf} />
        <Text style={[styles.guestSub, { marginTop: 12 }]}>Caricamento...</Text>
      </View>
    );
  }

  const username = profile?.username || user?.firstName || "Utente";
  const streak = profile?.streak ?? 0;
  const points = profile?.totalPoints ?? 0;
  const level = profile?.level ?? "Bronzo";
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
          tintColor={Colors.leaf}
        />
      }
    >
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="leaf" size={22} color={Colors.leaf} />
          </View>
          <View>
            <Text style={styles.logoText}>Leafy</Text>
            <Text style={styles.greeting}>Ciao, {username}!</Text>
            <View style={styles.streakRow}>
              <Feather name="zap" size={13} color={Colors.amber} />
              <Text style={styles.streakLabel}>{streak} giorni di fila</Text>
            </View>
          </View>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/profilo")}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {safeInitial}
            </Text>
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
          percentage={levelProgress}
        />

        <View style={styles.progressBarSection}>
          <View style={styles.progressBarLabels}>
            <Text style={styles.progressBarLabelText}>
              {LEVEL_LABELS[level] ?? level}
            </Text>
            <Text style={styles.progressBarLabelText}>
              {nextLevelPoints.toLocaleString("it-IT")} pts al prossimo
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${levelProgress}%` }]}
            />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(200).springify()}
        style={styles.motivationalBox}
      >
        <Text style={styles.motivationalText}>{motivationalMessage}</Text>
      </Animated.View>

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

      {impact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Il tuo impatto</Text>
          <View style={styles.impactRow}>
            <ImpactCard
              icon="cloud"
              label="CO2 risparmiata"
              value={impact.co2SavedKg}
              unit="kg"
            />
            <ImpactCard
              icon="droplet"
              label="Acqua risparmiata"
              value={impact.waterSavedLiters}
              unit="L"
            />
            <ImpactCard
              icon="package"
              label="Plastica evitata"
              value={impact.plasticAvoidedKg}
              unit="kg"
            />
          </View>
        </View>
      )}

      {challenges && challenges.filter((c) => !c.isCompleted).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sfide attive</Text>
          {challenges
            .filter((c) => !c.isCompleted)
            .slice(0, 2)
            .map((c) => (
              <View key={c.id} style={styles.challengeCard}>
                <View style={styles.challengeLeft}>
                  <Text style={styles.challengeName}>{c.title}</Text>
                  <Text style={styles.challengeDesc}>{c.description}</Text>
                  <View style={styles.challengeProgress}>
                    <View
                      style={[
                        styles.challengeProgressFill,
                        {
                          width: `${Math.min(
                            100,
                            ((c.currentCount ?? 0) / c.targetCount) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.challengeProgressText}>
                    {c.currentCount ?? 0}/{c.targetCount}
                  </Text>
                </View>
                <View style={styles.challengeRight}>
                  <Feather name="award" size={16} color={Colors.amber} />
                  <Text style={styles.challengePoints}>+{c.rewardPoints}</Text>
                </View>
              </View>
            ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiche rapide</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="file-text" size={22} color={Colors.leaf} />
            <Text style={styles.statValue}>
              {impact?.receiptsScanned ?? 0}
            </Text>
            <Text style={styles.statLabel}>Scontrini</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="shopping-bag" size={22} color={Colors.leaf} />
            <Text style={styles.statValue}>
              {impact?.greenProductsCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>Prodotti green</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="zap" size={22} color={Colors.amber} />
            <Text style={styles.statValue}>{profile?.streak ?? 0}</Text>
            <Text style={styles.statLabel}>Streak giorni</Text>
          </View>
        </View>
      </View>
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
  guestTitle: {
    fontSize: 24,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginTop: 16,
    textAlign: "center",
  },
  guestSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  loginBtn: {
    marginTop: 24,
    backgroundColor: Colors.leaf,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.leaf,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 16,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.text,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  streakLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitial: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  progressSection: {
    alignItems: "center",
    paddingVertical: 16,
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
  progressBarLabelText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
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
  motivationalText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.leaf,
    textAlign: "center",
    lineHeight: 22,
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
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
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
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  impactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  impactValue: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  impactUnit: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.leaf,
  },
  impactLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  challengeCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  challengeLeft: { flex: 1 },
  challengeName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  challengeDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  challengeProgress: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 4,
  },
  challengeProgressFill: {
    height: 4,
    backgroundColor: Colors.leaf,
    borderRadius: 2,
  },
  challengeProgressText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  challengeRight: {
    alignItems: "center",
    gap: 4,
  },
  challengePoints: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.amber,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
