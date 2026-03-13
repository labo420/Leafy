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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import type { Profile, ImpactStats, Challenge } from "@workspace/api-client-react";

const LEVEL_LABELS: Record<string, string> = {
  bronze: "Bronzo",
  silver: "Argento",
  gold: "Oro",
  platinum: "Platino",
};

const LEVEL_COLORS: Record<string, string[]> = {
  bronze: ["#CD7F32", "#A0522D"],
  silver: ["#A8A9AD", "#6C6C6C"],
  gold: ["#FFD700", "#DAA520"],
  platinum: ["#E5E4E2", "#A0A0A0"],
};

function LevelRing({ level, progress }: { level: string; progress: number }) {
  const animProgress = useSharedValue(0);
  useEffect(() => {
    animProgress.value = withTiming(progress, { duration: 1200 });
  }, [progress]);

  const colors = LEVEL_COLORS[level] ?? ["#2ECC71", "#27AE60"];

  return (
    <View style={styles.levelRingContainer}>
      <LinearGradient
        colors={[colors[0], colors[1]] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.levelRingOuter}
      >
        <View style={styles.levelRingInner}>
          <MaterialCommunityIcons name="leaf" size={28} color={Colors.leaf} />
        </View>
      </LinearGradient>
    </View>
  );
}

function ImpactCard({ icon, label, value, unit }: {
  icon: string; label: string; value: number; unit: string;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.impactCard}>
      <View style={styles.impactIcon}>
        <Feather name={icon as any} size={20} color={Colors.leaf} />
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

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<Profile>({
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
        <Text style={styles.guestSub}>Accedi per iniziare a guadagnare punti green</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.leaf} />}
    >
      {/* Header */}
      <LinearGradient
        colors={[Colors.forest, Colors.leaf]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPadding + 16 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Ciao, {profile?.username ?? user?.firstName ?? "Utente"}</Text>
            <Text style={styles.subGreeting}>Oggi puoi fare la differenza</Text>
          </View>
          <View style={styles.streakBadge}>
            <Feather name="zap" size={14} color={Colors.amber} />
            <Text style={styles.streakText}>{profile?.streak ?? 0}</Text>
          </View>
        </View>

        {/* Level & Points */}
        <View style={styles.levelCard}>
          <LevelRing level={profile?.level ?? "bronze"} progress={(profile?.levelProgress ?? 0) / 100} />
          <View style={styles.levelInfo}>
            <Text style={styles.levelName}>
              Livello {LEVEL_LABELS[profile?.level ?? "bronze"] ?? "Bronzo"}
            </Text>
            <Text style={styles.pointsText}>
              {(profile?.points ?? 0).toLocaleString("it-IT")} punti
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${profile?.levelProgress ?? 0}%` }]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {profile?.pointsToNextLevel ?? 0} punti al prossimo livello
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Scan Button */}
      <View style={styles.scanSection}>
        <Animated.View style={scanAnimStyle}>
          <Pressable style={styles.scanButton} onPress={handleScanPress}>
            <LinearGradient
              colors={[Colors.primary, Colors.leaf]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scanButtonGradient}
            >
              <View style={styles.scanButtonIcon}>
                <Feather name="camera" size={32} color="#fff" />
              </View>
              <Text style={styles.scanButtonTitle}>Scansiona scontrino</Text>
              <Text style={styles.scanButtonSub}>Guadagna punti per ogni prodotto green</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* Impact Stats */}
      {impact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Il tuo impatto</Text>
          <View style={styles.impactRow}>
            <ImpactCard icon="cloud" label="CO2 risparmiata" value={impact.co2SavedKg} unit="kg" />
            <ImpactCard icon="droplet" label="Acqua risparmiata" value={impact.waterSavedLiters} unit="L" />
            <ImpactCard icon="package" label="Plastica evitata" value={impact.plasticAvoidedKg} unit="kg" />
          </View>
        </View>
      )}

      {/* Active Challenges */}
      {challenges && challenges.filter((c) => !c.completed).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sfide attive</Text>
          {challenges
            .filter((c) => !c.completed)
            .slice(0, 2)
            .map((c) => (
              <View key={c.id} style={styles.challengeCard}>
                <View style={styles.challengeLeft}>
                  <Text style={styles.challengeName}>{c.name}</Text>
                  <Text style={styles.challengeDesc}>{c.description}</Text>
                  <View style={styles.challengeProgress}>
                    <View
                      style={[
                        styles.challengeProgressFill,
                        { width: `${Math.min(100, ((c.currentProgress ?? 0) / c.targetValue) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.challengeProgressText}>
                    {c.currentProgress ?? 0}/{c.targetValue}
                  </Text>
                </View>
                <View style={styles.challengeRight}>
                  <Feather name="award" size={16} color={Colors.amber} />
                  <Text style={styles.challengePoints}>+{c.bonusPoints}</Text>
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiche rapide</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="file-text" size={22} color={Colors.leaf} />
            <Text style={styles.statValue}>{impact?.receiptsScanned ?? 0}</Text>
            <Text style={styles.statLabel}>Scontrini</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="shopping-bag" size={22} color={Colors.leaf} />
            <Text style={styles.statValue}>{impact?.greenProductsCount ?? 0}</Text>
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
    fontFamily: "Inter_700Bold",
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
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.amber,
  },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  levelRingContainer: {},
  levelRingOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  levelRingInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  levelInfo: { flex: 1 },
  levelName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  pointsText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  scanSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  scanButton: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  scanButtonGradient: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  scanButtonIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  scanButtonTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  scanButtonSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
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
    borderRadius: 16,
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
    fontFamily: "Inter_700Bold",
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
    borderRadius: 16,
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
    borderRadius: 16,
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
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
