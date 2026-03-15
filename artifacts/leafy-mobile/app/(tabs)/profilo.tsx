import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Fonts } from "@/constants/typography";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import BadgeIcon3D from "@/components/BadgeIcon3D";
import type {
  Profile,
  ImpactStats,
  ReferralInfo,
  Challenge,
  BadgeItem,
  TemporalBadgeItem,
  MyBadgesResponse,
} from "@workspace/api-client-react";

type BadgeTab = "traguardi" | "sfide";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPeriod(periodKey: string, badgeType: string): string {
  if (badgeType === "weekly") {
    const [year, week] = periodKey.split("-W");
    return `Settimana ${parseInt(week)} — ${year}`;
  }
  if (badgeType === "monthly") {
    const [year, month] = periodKey.split("-");
    const monthNames = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
  const [year, quarter] = periodKey.split("-Q");
  return `Q${quarter} ${year}`;
}

function periodLabel(badgeType: string): string {
  if (badgeType === "weekly") return "Settimanale";
  if (badgeType === "monthly") return "Mensile";
  return "Stagionale";
}

function LifetimeBadgeCard({ badge }: { badge: BadgeItem }) {
  const progressPct = badge.targetCount > 1
    ? Math.min(100, (badge.currentProgress / badge.targetCount) * 100)
    : 0;

  return (
    <View
      style={[
        badgeStyles.card,
        !badge.isUnlocked && badgeStyles.cardLocked,
      ]}
    >
      <BadgeIcon3D
        emoji={badge.emoji}
        category={badge.category}
        isUnlocked={badge.isUnlocked}
        size={64}
      />
      <Text style={badgeStyles.name} numberOfLines={2}>
        {badge.name}
      </Text>
      <Text style={badgeStyles.category}>{badge.category}</Text>

      {badge.isUnlocked ? (
        <View style={badgeStyles.dateRow}>
          <Feather name="calendar" size={10} color={Colors.leaf} />
          <Text style={badgeStyles.dateText}>
            Sbloccato il {formatDate(badge.unlockedAt)}
          </Text>
        </View>
      ) : (
        <View style={badgeStyles.hintSection}>
          <View style={badgeStyles.hintRow}>
            <Feather name="lock" size={10} color={Colors.textMuted} />
            <Text style={badgeStyles.hintText} numberOfLines={1}>
              {badge.unlockHint}
            </Text>
          </View>
          {badge.targetCount > 1 && (
            <>
              <View style={badgeStyles.progressTrack}>
                <View
                  style={[badgeStyles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>
              <Text style={badgeStyles.progressText}>
                {badge.currentProgress}/{badge.targetCount}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function TemporalBadgeCard({
  badge,
  compact,
}: {
  badge: TemporalBadgeItem;
  compact?: boolean;
}) {
  const progressPct = badge.targetCount > 0
    ? Math.min(100, (badge.currentProgress / badge.targetCount) * 100)
    : 0;

  if (compact) {
    return (
      <View style={badgeStyles.archivedCard}>
        <BadgeIcon3D
          emoji={badge.emoji}
          badgeType={badge.badgeType}
          isUnlocked={badge.isUnlocked}
          size={40}
        />
        <Text style={badgeStyles.archivedName} numberOfLines={1}>
          {badge.name}
        </Text>
        <Text style={badgeStyles.archivedPeriod}>
          {formatPeriod(badge.periodKey, badge.badgeType)}
        </Text>
        {badge.isUnlocked && badge.unlockedAt && (
          <Text style={badgeStyles.archivedDate}>
            {formatDate(badge.unlockedAt)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        badgeStyles.card,
        badge.isUnlocked && badgeStyles.cardActive,
      ]}
    >
      <BadgeIcon3D
        emoji={badge.emoji}
        badgeType={badge.badgeType}
        isUnlocked={badge.isUnlocked}
        size={64}
      />
      <Text style={badgeStyles.name} numberOfLines={2}>
        {badge.name}
      </Text>
      <View style={badgeStyles.typeBadge}>
        <Text style={badgeStyles.typeBadgeText}>{periodLabel(badge.badgeType)}</Text>
      </View>

      {badge.isUnlocked ? (
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={[badgeStyles.dateText, { color: Colors.leaf }]}>
            Completata!
          </Text>
          <View style={badgeStyles.dateRow}>
            <Feather name="calendar" size={9} color={Colors.textMuted} />
            <Text style={[badgeStyles.dateText, { color: Colors.textMuted }]}>
              {formatDate(badge.unlockedAt)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ width: "100%" }}>
          <View style={badgeStyles.progressTrack}>
            <View
              style={[badgeStyles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>
          <Text style={badgeStyles.progressText}>
            {badge.currentProgress}/{badge.targetCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: "45%",
  },
  cardLocked: {
    opacity: 0.7,
    borderStyle: "dashed",
  },
  cardActive: {
    borderColor: "rgba(46,107,80,0.2)",
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 16,
  },
  category: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.leaf,
  },
  hintSection: {
    width: "100%",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.mint,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "right",
  },
  typeBadge: {
    backgroundColor: Colors.cardAlt,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  typeBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  archivedCard: {
    flex: 1,
    backgroundColor: Colors.cardAlt,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: "30%",
  },
  archivedEmoji: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  archivedName: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 14,
  },
  archivedPeriod: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  archivedDate: {
    fontSize: 7,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default function ProfiloScreen() {
  const insets = useSafeAreaInsets();
  const { user, refetch } = useAuth();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("traguardi");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  const { data: profile, refetch: refetchProfile } = useQuery<Profile>({
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

  const { data: badgesData } = useQuery<MyBadgesResponse>({
    queryKey: ["badges"],
    queryFn: () => apiFetch("/badges/my"),
    enabled: !!user,
  });

  const lifetimeBadges = badgesData?.lifetime ?? [];
  const temporalBadges = badgesData?.temporal ?? [];
  const activeTemporal = temporalBadges.filter((b) => !b.isExpired);
  const archivedTemporal = temporalBadges.filter((b) => b.isExpired);

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
            router.replace("/(tabs)");
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

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permesso necessario",
        "Devi consentire l'accesso alla galleria per cambiare la foto profilo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    const base64Data = `data:${mimeType};base64,${asset.base64}`;

    setUploadingImage(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/profile/image`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageData: base64Data }),
      });
      if (!res.ok) throw new Error("Upload failed");
      await Promise.all([refetchProfile(), refetch()]);
      Alert.alert("Fatto!", "Immagine aggiornata con successo.");
    } catch {
      Alert.alert("Errore", "Impossibile aggiornare l'immagine del profilo.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Text style={{ fontSize: 48 }}>👤</Text>
        <Text style={styles.guestTitle}>Il tuo profilo</Text>
        <Text style={styles.guestSub}>
          Accedi per vedere i tuoi progressi
        </Text>
        <Pressable
          style={styles.loginBtn}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  const username = profile?.username || user?.firstName || "Utente";
  const safeInitial = (username.trim().charAt(0) || "U").toUpperCase();
  const level = profile?.level ?? "Bronzo";
  const profileImageUrl = user?.profileImageUrl;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <View style={styles.decorCircleBig} />
        <View style={styles.decorCircleSmall} />
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profilo</Text>
          <Pressable
            style={styles.settingsBtn}
            onPress={() => router.push("/impostazioni")}
          >
            <Feather name="settings" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.avatarCard}>
        <View style={styles.avatarContainer}>
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{safeInitial}</Text>
            </View>
          )}
          <Pressable
            style={styles.cameraBtn}
            onPress={handlePickImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="camera" size={14} color="#fff" />
            )}
          </Pressable>
        </View>
        <Text style={styles.username}>{username}</Text>
        <View style={styles.levelPill}>
          <MaterialCommunityIcons
            name={level === "Bronzo" || level === "bronze" ? "medal" : level === "Argento" || level === "silver" ? "medal" : level === "Oro" || level === "gold" ? "medal" : "diamond-stone"}
            size={16}
            color={level === "Bronzo" || level === "bronze" ? "#CD7F32" : level === "Argento" || level === "silver" ? "#C0C0C0" : level === "Oro" || level === "gold" ? "#FFD700" : "#B9F2FF"}
          />
          <Text style={styles.levelPillText}>Livello {level}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={{ fontSize: 18 }}>📊</Text>
          <Text style={styles.sectionTitle}>Il tuo impatto verde</Text>
        </View>
        <View style={styles.impactGrid}>
          <View style={[styles.impactCard, { backgroundColor: "#EFF6FF" }]}>
            <View style={[styles.impactIconCircle, { backgroundColor: "#DBEAFE" }]}>
              <Text style={{ fontSize: 20 }}>🌍</Text>
            </View>
            <Text style={styles.impactValue}>
              {(impact?.co2SavedKg ?? 0).toFixed(1)}{" "}
              <Text style={styles.impactUnit}>kg</Text>
            </Text>
            <Text style={styles.impactLabel}>CO₂ risparmiata</Text>
          </View>
          <View style={[styles.impactCard, { backgroundColor: "#F0FDFA" }]}>
            <View style={[styles.impactIconCircle, { backgroundColor: "#CCFBF1" }]}>
              <Text style={{ fontSize: 20 }}>💧</Text>
            </View>
            <Text style={styles.impactValue}>
              {(impact?.waterSavedLiters ?? 0).toFixed(0)}{" "}
              <Text style={styles.impactUnit}>L</Text>
            </Text>
            <Text style={styles.impactLabel}>Acqua salvata</Text>
          </View>
        </View>
        <Text style={styles.impactDisclaimer}>
          Stime indicative basate sulla categoria del prodotto.
        </Text>
      </Animated.View>

      {referral && (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <Pressable style={styles.referralCard} onPress={handleShare}>
            <View style={styles.referralLeft}>
              <Text style={{ fontSize: 22 }}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Invita un amico</Text>
                <Text style={styles.referralSub}>
                  +500 punti per entrambi!
                </Text>
              </View>
            </View>
            <View style={styles.referralCopyBtn}>
              <Feather name="share-2" size={16} color={Colors.leaf} />
            </View>
          </Pressable>
        </Animated.View>
      )}

      {challenges && challenges.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="target" size={18} color={Colors.leaf} />
            <Text style={styles.sectionTitle}>Sfide Attive</Text>
            <View style={styles.monthBadge}>
              <Text style={styles.monthBadgeText}>Mese in corso</Text>
            </View>
          </View>
          {challenges.map((c) => (
            <View key={c.id} style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeName}>{c.title}</Text>
                {c.isCompleted ? (
                  <View style={styles.completedBadge}>
                    <Feather name="check" size={12} color={Colors.leaf} />
                    <Text style={styles.completedText}>Completata</Text>
                  </View>
                ) : (
                  <Text style={styles.challengeBonus}>+{c.rewardPoints} pt</Text>
                )}
              </View>
              <Text style={styles.challengeDesc}>{c.description}</Text>
              <View style={styles.challengeProgressWrap}>
                <View
                  style={[
                    styles.challengeProgressFill,
                    {
                      width: `${Math.min(100, c.progressPercent)}%`,
                      backgroundColor: c.isCompleted ? Colors.leaf : Colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.challengeProgressLabel}>
                {c.currentCount} / {c.targetCount}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="award" size={18} color={Colors.leaf} />
          <Text style={styles.sectionTitle}>Collezione Badge</Text>
        </View>

        <View style={styles.tabSwitcher}>
          <Pressable
            style={[styles.tab, badgeTab === "traguardi" && styles.tabActive]}
            onPress={() => setBadgeTab("traguardi")}
          >
            <Text
              style={[
                styles.tabText,
                badgeTab === "traguardi" && styles.tabTextActive,
              ]}
            >
              Traguardi
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, badgeTab === "sfide" && styles.tabActive]}
            onPress={() => setBadgeTab("sfide")}
          >
            <Text
              style={[
                styles.tabText,
                badgeTab === "sfide" && styles.tabTextActive,
              ]}
            >
              Sfide
            </Text>
          </Pressable>
        </View>

        {badgeTab === "traguardi" ? (
          <View style={styles.badgeGrid}>
            {lifetimeBadges.length > 0 ? (
              lifetimeBadges.map((badge) => (
                <LifetimeBadgeCard key={badge.id} badge={badge} />
              ))
            ) : (
              <View style={styles.emptyBadges}>
                <Feather name="award" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyBadgesText}>
                  Nessun traguardo ancora. Inizia a scansionare!
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View>
            {activeTemporal.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View style={styles.temporalSectionHeader}>
                  <Feather name="clock" size={12} color={Colors.leaf} />
                  <Text style={styles.temporalSectionTitle}>Attive</Text>
                </View>
                <View style={styles.badgeGrid}>
                  {activeTemporal.map((badge, i) => (
                    <TemporalBadgeCard
                      key={`${badge.id}-${badge.periodKey}-${i}`}
                      badge={badge}
                    />
                  ))}
                </View>
              </View>
            )}

            {archivedTemporal.length > 0 && (
              <View>
                <Text style={styles.archivedSectionTitle}>Archivio</Text>
                <View style={styles.archivedGrid}>
                  {archivedTemporal.map((badge, i) => (
                    <TemporalBadgeCard
                      key={`${badge.id}-${badge.periodKey}-${i}`}
                      badge={badge}
                      compact
                    />
                  ))}
                </View>
              </View>
            )}

            {activeTemporal.length === 0 && archivedTemporal.length === 0 && (
              <View style={styles.emptyBadges}>
                <Feather name="target" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyBadgesText}>
                  Le sfide a tempo appariranno qui.
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

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
    backgroundColor: Colors.leaf,
    paddingHorizontal: 20,
    paddingBottom: 60,
    position: "relative",
    overflow: "hidden",
  },
  decorCircleBig: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorCircleSmall: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCard: {
    marginHorizontal: 20,
    marginTop: -40,
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: Colors.background,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 24,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  username: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginBottom: 8,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelPillText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    flex: 1,
  },
  monthBadge: {
    backgroundColor: "rgba(46,107,80,0.1)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  monthBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.leaf,
  },
  impactGrid: {
    flexDirection: "row",
    gap: 12,
  },
  impactCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  impactIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  impactValue: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  impactUnit: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  impactLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  impactDisclaimer: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  referralCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(46,107,80,0.08)",
    borderRadius: 24,
    padding: 16,
  },
  referralLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  referralTitle: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  referralSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  referralCopyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(46,107,80,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  challengeCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
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
    fontFamily: "DMSans_700Bold",
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
    lineHeight: 18,
  },
  challengeProgressWrap: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  challengeProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  challengeProgressLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: Colors.cardAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  emptyBadges: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyBadgesText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  temporalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  temporalSectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.leaf,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  archivedSectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  archivedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.08)",
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.red,
  },
});
