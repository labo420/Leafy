import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import type { Profile, ImpactStats, ReferralInfo, Challenge } from "@workspace/api-client-react";

const LEVEL_LABELS: Record<string, string> = {
  bronze: "Bronzo",
  silver: "Argento",
  gold: "Oro",
  platinum: "Platino",
};

const LEVEL_GRADIENT: Record<string, [string, string]> = {
  bronze: ["#CD7F32", "#A0522D"],
  silver: ["#C0C0C0", "#808080"],
  gold: ["#FFD700", "#DAA520"],
  platinum: ["#E5E4E2", "#9E9E9E"],
};

function BadgeItem({ badge }: { badge: any }) {
  return (
    <View style={[styles.badgeItem, !badge.earned && styles.badgeItemLocked]}>
      <View style={[styles.badgeIcon, !badge.earned && styles.badgeIconLocked]}>
        <Feather name="award" size={22} color={badge.earned ? Colors.amber : Colors.textMuted} />
      </View>
      <Text style={[styles.badgeName, !badge.earned && styles.badgeNameLocked]} numberOfLines={2}>
        {badge.name}
      </Text>
    </View>
  );
}

export default function ProfiloScreen() {
  const insets = useSafeAreaInsets();
  const { user, refetch } = useAuth();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: !!user,
  });

  const { data: impact } = useQuery<ImpactStats>({
    queryKey: ["impact"],
    queryFn: () => apiFetch("/profile/impact"),
    enabled: !!user,
  });

  const { data: referral } = useQuery<ReferralInfo>({
    queryKey: ["referral"],
    queryFn: () => apiFetch("/profile/referral"),
    enabled: !!user,
  });

  const { data: challenges } = useQuery<Challenge[]>({
    queryKey: ["challenges"],
    queryFn: () => apiFetch("/challenges"),
    enabled: !!user,
  });

  const handleLogout = async () => {
    Alert.alert("Esci", "Sei sicuro di voler uscire?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            const domain = process.env.EXPO_PUBLIC_DOMAIN;
            const base = domain ? `https://${domain}` : "";
            await fetch(`${base}/api/auth/logout`, {
              method: "POST",
              credentials: "include",
            });
          } finally {
            queryClient.clear();
            await refetch();
            router.replace("/login");
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!referral) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Unisciti a Leafy con il mio codice referral: ${referral.code}\n${referral.referralUrl}`,
      title: "Invita un amico su Leafy",
    });
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Feather name="user" size={48} color={Colors.primaryMuted} />
        <Text style={styles.guestTitle}>Il tuo profilo</Text>
        <Text style={styles.guestSub}>Accedi per vedere i tuoi progressi</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  const level = profile?.level ?? "bronze";
  const gradColors = LEVEL_GRADIENT[level] ?? [Colors.leaf, Colors.forest];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={[Colors.forest, Colors.leaf]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPadding + 16 }]}
      >
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={gradColors}
            style={styles.avatar}
          >
            <Text style={styles.avatarInitial}>
              {(profile?.username ?? user?.firstName ?? "U")[0].toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{LEVEL_LABELS[level]}</Text>
          </View>
        </View>

        <Text style={styles.username}>{profile?.username ?? user?.firstName ?? "Utente"}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}

        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{(profile?.points ?? 0).toLocaleString("it-IT")}</Text>
            <Text style={styles.headerStatLabel}>Punti</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{profile?.streak ?? 0}</Text>
            <Text style={styles.headerStatLabel}>Streak</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{impact?.receiptsScanned ?? 0}</Text>
            <Text style={styles.headerStatLabel}>Scontrini</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Impact Summary */}
      {impact && (
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Impatto ambientale</Text>
          <View style={styles.impactGrid}>
            <View style={styles.impactBox}>
              <Feather name="cloud" size={20} color={Colors.leaf} />
              <Text style={styles.impactBoxValue}>{impact.co2SavedKg.toFixed(1)} kg</Text>
              <Text style={styles.impactBoxLabel}>CO2 risparmiata</Text>
            </View>
            <View style={styles.impactBox}>
              <Feather name="droplet" size={20} color={Colors.blue} />
              <Text style={styles.impactBoxValue}>{impact.waterSavedLiters.toFixed(0)} L</Text>
              <Text style={styles.impactBoxLabel}>Acqua risparmiata</Text>
            </View>
            <View style={styles.impactBox}>
              <Feather name="package" size={20} color={Colors.amber} />
              <Text style={styles.impactBoxValue}>{impact.plasticAvoidedKg.toFixed(2)} kg</Text>
              <Text style={styles.impactBoxLabel}>Plastica evitata</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Challenges */}
      {challenges && challenges.length > 0 && (
        <Animated.View entering={FadeInDown.delay(150)} style={styles.section}>
          <Text style={styles.sectionTitle}>Sfide del mese</Text>
          {challenges.map((c) => (
            <View key={c.id} style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeName}>{c.name}</Text>
                {c.completed ? (
                  <View style={styles.completedBadge}>
                    <Feather name="check" size={12} color={Colors.leaf} />
                    <Text style={styles.completedText}>Completata</Text>
                  </View>
                ) : (
                  <Text style={styles.challengeBonus}>+{c.bonusPoints} pt</Text>
                )}
              </View>
              <Text style={styles.challengeDesc}>{c.description}</Text>
              <View style={styles.challengeProgressWrap}>
                <View
                  style={[
                    styles.challengeProgressFill,
                    {
                      width: `${Math.min(100, ((c.currentProgress ?? 0) / c.targetValue) * 100)}%`,
                      backgroundColor: c.completed ? Colors.leaf : Colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.challengeProgressLabel}>
                {c.currentProgress ?? 0} / {c.targetValue}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Referral */}
      {referral && (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Invita amici</Text>
          <Pressable style={styles.referralCard} onPress={handleShare}>
            <LinearGradient
              colors={[Colors.leaf, Colors.forest]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.referralGradient}
            >
              <Feather name="users" size={28} color="#fff" />
              <View style={styles.referralInfo}>
                <Text style={styles.referralCode}>{referral.code}</Text>
                <Text style={styles.referralSub}>
                  {referral.referralCount} amici invitati · {referral.pointsEarned} punti guadagnati
                </Text>
              </View>
              <Feather name="share-2" size={20} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {/* Badges */}
      {profile?.badges && profile.badges.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
          <Text style={styles.sectionTitle}>Badge ({profile.badges.filter((b: any) => b.earned).length})</Text>
          <View style={styles.badgesGrid}>
            {profile.badges.map((b: any, i: number) => (
              <BadgeItem key={i} badge={b} />
            ))}
          </View>
        </Animated.View>
      )}

      {/* Logout */}
      <View style={styles.section}>
        <Pressable
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={Colors.red} />
          ) : (
            <>
              <Feather name="log-out" size={18} color={Colors.red} />
              <Text style={styles.logoutText}>Esci dall'account</Text>
            </>
          )}
        </Pressable>
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
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "center",
  },
  avatarWrap: {
    marginBottom: 16,
    position: "relative",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarInitial: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: Colors.amber,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  levelBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  username: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 20,
  },
  headerStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: "100%",
  },
  headerStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  headerStatDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginVertical: 4,
  },
  headerStatValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerStatLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
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
  impactGrid: {
    flexDirection: "row",
    gap: 10,
  },
  impactBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  impactBoxValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  impactBoxLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  challengeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  challengeName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    flex: 1,
  },
  challengeBonus: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.amber,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.leaf,
  },
  challengeDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 19,
  },
  challengeProgressWrap: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginBottom: 4,
    overflow: "hidden",
  },
  challengeProgressFill: {
    height: 5,
    borderRadius: 3,
  },
  challengeProgressLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  referralCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  referralGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  referralInfo: { flex: 1 },
  referralCode: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 2,
    marginBottom: 2,
  },
  referralSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeItem: {
    width: "22%",
    alignItems: "center",
    gap: 6,
  },
  badgeItemLocked: { opacity: 0.45 },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF3CD",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.amber,
  },
  badgeIconLocked: {
    backgroundColor: Colors.cardAlt,
    borderColor: Colors.border,
  },
  badgeName: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "center",
  },
  badgeNameLocked: {
    color: Colors.textMuted,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: Colors.red,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.red,
  },
});
