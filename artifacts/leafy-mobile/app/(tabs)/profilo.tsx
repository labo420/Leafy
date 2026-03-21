import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { XpIcon } from "../../components/XpIcon";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
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
import { useTheme } from "@/context/theme";
import BadgeIcon3D from "@/components/BadgeIcon3D";
import LeafyGoldModal from "@/components/LeafyGoldModal";
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

type ImpactMetric = {
  icon: React.ComponentProps<typeof Feather>["name"];
  value: number;
  unit: string;
  label: string;
  equiv: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  decimals: number;
};

function ImpactMetricCard({ m, animate, theme }: { m: ImpactMetric; animate: boolean; theme: import("@/constants/theme").ThemeColors }) {
  const [display, setDisplay] = useState("0");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!animate || started || m.value === 0) return;
    setStarted(true);

    const start = Date.now();
    const duration = 1200;
    let timeout: any = null;

    const step = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = m.value * eased;
      setDisplay(m.decimals > 0 ? val.toFixed(m.decimals) : Math.round(val).toString());

      if (p < 1) {
        timeout = setTimeout(step, 16);
      }
    };

    timeout = setTimeout(step, 0);
    return () => { if (timeout) clearTimeout(timeout); };
  }, [animate, m.value, m.decimals, started]);

  return (
    <View style={[impactStyles.card, { backgroundColor: m.bg }]}>
      <View style={[impactStyles.iconCircle, { backgroundColor: m.iconBg }]}>
        <Feather name={m.icon} size={18} color={m.iconColor} />
      </View>
      <Text style={[impactStyles.value, { color: theme.text }]}>
        {display}
        {m.unit ? <Text style={[impactStyles.unit, { color: theme.textSecondary }]}> {m.unit}</Text> : null}
      </Text>
      <Text style={[impactStyles.label, { color: theme.textSecondary }]}>{m.label}</Text>
      {m.equiv ? <Text style={[impactStyles.equiv, { color: theme.textMuted }]}>{m.equiv}</Text> : null}
    </View>
  );
}

const impactStyles = StyleSheet.create({
  card: {
    width: 130,
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    gap: 4,
    marginRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  unit: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  equiv: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
});

function LifetimeBadgeCard({ badge, theme }: { badge: BadgeItem; theme: import("@/constants/theme").ThemeColors }) {
  const progressPct = badge.targetCount > 1
    ? Math.min(100, (badge.currentProgress / badge.targetCount) * 100)
    : 0;

  return (
    <View
      style={[
        badgeStyles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        !badge.isUnlocked && badgeStyles.cardLocked,
      ]}
    >
      <BadgeIcon3D
        emoji={badge.emoji}
        category={badge.category}
        name={badge.name}
        isUnlocked={badge.isUnlocked}
        size={52}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[badgeStyles.name, { color: theme.text }]} numberOfLines={1}>
          {badge.name}
        </Text>
        <Text style={[badgeStyles.category, { color: theme.textMuted }]}>{badge.category}</Text>

        {badge.isUnlocked ? (
          <View style={badgeStyles.dateRow}>
            <Feather name="calendar" size={10} color={theme.leaf} />
            <Text style={[badgeStyles.dateText, { color: theme.leaf }]}>
              Sbloccato il {formatDate(badge.unlockedAt)}
            </Text>
          </View>
        ) : (
          <View style={badgeStyles.hintSection}>
            <View style={badgeStyles.hintRow}>
              <Feather name="lock" size={10} color={theme.textMuted} />
              <Text style={[badgeStyles.hintText, { color: theme.textMuted }]} numberOfLines={1}>
                {badge.unlockHint}
              </Text>
            </View>
            {badge.targetCount > 1 && (
              <>
                <View style={[badgeStyles.progressTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[badgeStyles.progressFill, { width: `${progressPct}%`, backgroundColor: theme.mint }]}
                  />
                </View>
                <Text style={[badgeStyles.progressText, { color: theme.textMuted }]}>
                  {badge.currentProgress}/{badge.targetCount}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function TemporalBadgeCard({
  badge,
  compact,
  theme,
}: {
  badge: TemporalBadgeItem;
  compact?: boolean;
  theme: import("@/constants/theme").ThemeColors;
}) {
  const progressPct = badge.targetCount > 0
    ? Math.min(100, (badge.currentProgress / badge.targetCount) * 100)
    : 0;

  if (compact) {
    return (
      <View style={[badgeStyles.archivedCard, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
        <BadgeIcon3D
          emoji={badge.emoji}
          badgeType={badge.badgeType}
          name={badge.name}
          isUnlocked={badge.isUnlocked}
          size={40}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[badgeStyles.archivedName, { color: theme.textSecondary }]} numberOfLines={1}>
            {badge.name}
          </Text>
          <Text style={[badgeStyles.archivedPeriod, { color: theme.textMuted }]}>
            {formatPeriod(badge.periodKey, badge.badgeType)}
          </Text>
          {badge.isUnlocked && badge.unlockedAt && (
            <Text style={[badgeStyles.archivedDate, { color: theme.textMuted }]}>
              {formatDate(badge.unlockedAt)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        badgeStyles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        badge.isUnlocked && badgeStyles.cardActive,
      ]}
    >
      <BadgeIcon3D
        emoji={badge.emoji}
        badgeType={badge.badgeType}
        name={badge.name}
        isUnlocked={badge.isUnlocked}
        size={52}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[badgeStyles.name, { color: theme.text }]} numberOfLines={1}>
          {badge.name}
        </Text>
        <View style={[badgeStyles.typeBadge, { backgroundColor: theme.cardAlt }]}>
          <Text style={[badgeStyles.typeBadgeText, { color: theme.textSecondary }]}>{periodLabel(badge.badgeType)}</Text>
        </View>

        {badge.isUnlocked ? (
          <View style={{ gap: 2 }}>
            <Text style={[badgeStyles.dateText, { color: theme.leaf }]}>
              Completata!
            </Text>
            <View style={badgeStyles.dateRow}>
              <Feather name="calendar" size={9} color={theme.textMuted} />
              <Text style={[badgeStyles.dateText, { color: theme.textMuted }]}>
                {formatDate(badge.unlockedAt)}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <View style={[badgeStyles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[badgeStyles.progressFill, { width: `${progressPct}%`, backgroundColor: theme.mint }]}
              />
            </View>
            <Text style={[badgeStyles.progressText, { color: theme.textMuted }]}>
              {badge.currentProgress}/{badge.targetCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLocked: {
    opacity: 0.7,
    borderStyle: "dashed",
  },
  cardActive: {
    borderColor: "rgba(46,107,80,0.2)",
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "left",
    marginBottom: 2,
    lineHeight: 18,
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
    width: "100%",
    backgroundColor: Colors.cardAlt,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
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
  const { user, refetch, hasLeafyGold, logout } = useAuth();
  const { theme, mode, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("traguardi");
  const [impactVisible, setImpactVisible] = useState(false);
  const [showLeafyGoldModal, setShowLeafyGoldModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  useEffect(() => {
    if (params.tab === "sfide") setBadgeTab("sfide");
    else if (params.tab === "traguardi") setBadgeTab("traguardi");
  }, [params.tab]);

  const topPadding = Platform.OS === "web" ? 67 : 0;
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

  type KitSlotData = { id: string; label: string; matchCategories: string[]; completed: boolean };
  type KitData = {
    id: string; name: string; description: string | null; rewardXp: number;
    isCompleted: boolean; completedAt: string | null;
    slots: KitSlotData[]; completedCount: number; totalCount: number; progressPercent: number;
  };

  const { data: kits } = useQuery<KitData[]>({
    queryKey: ["kits"],
    queryFn: () => apiFetch("/kits"),
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
            await logout();
            queryClient.clear();
            router.replace("/(tabs)");
          } finally {
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
      <View style={[styles.centered, { paddingTop: topPadding, backgroundColor: theme.background }]}>
        <Text style={{ fontSize: 48 }}>👤</Text>
        <Text style={[styles.guestTitle, { color: theme.text }]}>Il tuo profilo</Text>
        <Text style={[styles.guestSub, { color: theme.textSecondary }]}>
          Accedi per vedere i tuoi progressi
        </Text>
        <Pressable
          style={[styles.loginBtn, { backgroundColor: theme.leaf }]}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  const username = profile?.username || user?.firstName || "Utente";
  const safeInitial = (username.trim().charAt(0) || "U").toUpperCase();
  const level = profile?.level ?? "Germoglio";
  const profileImageUrl = user?.profileImageUrl;

  return (
    <>
      <LeafyGoldModal visible={showLeafyGoldModal} onClose={() => setShowLeafyGoldModal(false)} />
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: mode === "dark" ? Colors.leaf : "#F2F9F5" }]}>
        <View style={[styles.decorCircleBig, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(46,107,80,0.07)" }]} />
        <View style={[styles.decorCircleSmall, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(46,107,80,0.05)" }]} />
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: mode === "dark" ? "#fff" : "#1A3028" }]}>Profilo</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              style={[styles.settingsBtn, { backgroundColor: mode === "dark" ? "rgba(0,0,0,0.1)" : "rgba(46,107,80,0.10)" }]}
              onPress={() => router.push("/impostazioni")}
            >
              <Feather name="settings" size={20} color={mode === "dark" ? "#fff" : "#2E6B50"} />
            </Pressable>
          </View>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.avatarCard, { backgroundColor: theme.card }]}>
        <View style={styles.avatarContainer}>
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={[styles.avatar, { borderColor: theme.background }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: theme.background }]}>
              <Text style={styles.avatarInitial}>{safeInitial}</Text>
            </View>
          )}
          <Pressable
            style={[styles.cameraBtn, { backgroundColor: theme.leaf }]}
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
        <Text style={[styles.username, { color: theme.text }]}>{username}</Text>
        <View style={[styles.levelPill, { backgroundColor: theme.cardAlt }]}>
          <MaterialCommunityIcons name="leaf" size={14} color={theme.leaf} />
          <Text style={[styles.levelPillText, { color: theme.text }]}>Livello {level}</Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(150).springify()}
        style={styles.section}
        onLayout={() => { if (!impactVisible) setImpactVisible(true); }}
      >
        <View style={styles.sectionHeader}>
          <Feather name="bar-chart-2" size={18} color={theme.leaf} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Il tuo impatto verde</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {[
            { icon: "globe", iconColor: "#2563EB", value: impact?.co2SavedKg ?? 0, unit: "kg", label: "CO₂ risparmiata", equiv: `≈ ${Math.round((impact?.co2SavedKg ?? 0) * 5)} km in auto`, bg: mode === "dark" ? "#1a2540" : "#EFF6FF", iconBg: mode === "dark" ? "#1e3a7a" : "#DBEAFE", decimals: 1 },
            { icon: "droplet", iconColor: "#0D9488", value: impact?.waterSavedLiters ?? 0, unit: "L", label: "Acqua salvata", equiv: `≈ ${Math.round((impact?.waterSavedLiters ?? 0) / 40)} docce`, bg: mode === "dark" ? "#12302c" : "#F0FDFA", iconBg: mode === "dark" ? "#1a4a44" : "#CCFBF1", decimals: 0 },
            { icon: "refresh-cw", iconColor: "#D97706", value: impact?.plasticAvoidedKg ?? 0, unit: "kg", label: "Plastica evitata", equiv: `≈ ${Math.round((impact?.plasticAvoidedKg ?? 0) / 0.025)} bottiglie`, bg: mode === "dark" ? "#2a1e0d" : "#FFF7ED", iconBg: mode === "dark" ? "#3a2810" : "#FFEDD5", decimals: 2 },
            { icon: "feather", iconColor: theme.leaf, value: impact?.greenProductsCount ?? 0, unit: "", label: "Prodotti green", equiv: `${impact?.greenProductsCount ?? 0} articoli eco`, bg: theme.primaryLight, iconBg: mode === "dark" ? "#1E3328" : "#DCFCE7", decimals: 0 },
            { icon: "file-text", iconColor: "#7C3AED", value: impact?.receiptsScanned ?? 0, unit: "", label: "Scontrini", equiv: `${impact?.receiptsScanned ?? 0} analizzati`, bg: mode === "dark" ? "#1e1226" : "#FAF5FF", iconBg: mode === "dark" ? "#2d1a3e" : "#F3E8FF", decimals: 0 },
          ].map((m, i) => (
            <ImpactMetricCard key={i} m={m} animate={impactVisible} theme={theme} />
          ))}
        </ScrollView>
        <Text style={[styles.impactDisclaimer, { color: theme.textMuted }]}>
          Stime indicative basate sulla categoria del prodotto.
        </Text>
      </Animated.View>

      {referral && (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <Pressable style={styles.referralCard} onPress={handleShare}>
            <View style={styles.referralLeft}>
              <Text style={{ fontSize: 22 }}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.referralTitle, { color: theme.text }]}>Invita un amico</Text>
                <Text style={[styles.referralSub, { color: theme.textSecondary }]}>
                  +50 XP bonus + moltiplicatore XP per entrambi!
                </Text>
              </View>
            </View>
            <View style={styles.referralCopyBtn}>
              <Feather name="share-2" size={16} color={theme.leaf} />
            </View>
          </Pressable>

          {((profile as any)?.referralXpMultiplierRemaining ?? 0) > 0 && (
            <View style={[kitStyles.multiplierBanner, { backgroundColor: mode === "dark" ? "#1E3328" : "#D1FAE5" }]}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[kitStyles.multiplierTitle, { color: theme.leaf }]}>
                  Moltiplicatore XP attivo!
                </Text>
                <Text style={[kitStyles.multiplierSub, { color: mode === "dark" ? "#86EFAC" : "#166534" }]}>
                  +20% XP sui prossimi {(profile as any).referralXpMultiplierRemaining} scontrini
                </Text>
              </View>
              <MaterialCommunityIcons name="fire" size={20} color="#F97316" />
            </View>
          )}
        </Animated.View>
      )}

      {challenges && challenges.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="target" size={18} color={theme.leaf} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Sfide Attive</Text>
            <View style={[styles.monthBadge, { backgroundColor: "rgba(46,107,80,0.1)" }]}>
              <Text style={[styles.monthBadgeText, { color: theme.leaf }]}>Mese in corso</Text>
            </View>
          </View>
          {challenges.map((c) => (
            <View key={c.id} style={[styles.challengeCard, { backgroundColor: theme.card }]}>
              <View style={styles.challengeHeader}>
                <Text style={[styles.challengeName, { color: theme.text }]}>{c.title}</Text>
                {c.isCompleted ? (
                  <View style={[styles.completedBadge, { backgroundColor: theme.primaryLight }]}>
                    <Feather name="check" size={12} color={theme.leaf} />
                    <Text style={[styles.completedText, { color: theme.leaf }]}>Completata</Text>
                  </View>
                ) : (
                  <Text style={[styles.challengeBonus, { color: theme.amber }]}>+{c.rewardPoints} pt</Text>
                )}
              </View>
              <Text style={[styles.challengeDesc, { color: theme.textSecondary }]}>{c.description}</Text>
              <View style={[styles.challengeProgressWrap, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.challengeProgressFill,
                    {
                      width: `${Math.min(100, c.progressPercent)}%`,
                      backgroundColor: c.isCompleted ? theme.leaf : theme.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.challengeProgressLabel, { color: theme.textMuted }]}>
                {c.currentCount} / {c.targetCount}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {kits && kits.length > 0 && (
        <Animated.View entering={FadeInDown.delay(270).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="basket-outline" size={18} color={theme.leaf} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Kit Sostenibilità</Text>
          </View>
          {kits.map((kit) => (
            <View key={kit.id} style={[kitStyles.kitCard, { backgroundColor: theme.card }]}>
              <View style={kitStyles.kitHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[kitStyles.kitName, { color: theme.text }]}>{kit.name}</Text>
                  {kit.description ? (
                    <Text style={[kitStyles.kitDesc, { color: theme.textSecondary }]}>{kit.description}</Text>
                  ) : null}
                </View>
                <View style={[kitStyles.kitXpPill, { backgroundColor: kit.isCompleted ? theme.primaryLight : theme.cardAlt }]}>
                  {kit.isCompleted ? (
                    <>
                      <Feather name="check" size={11} color={theme.leaf} />
                      <Text style={[kitStyles.kitXpText, { color: theme.leaf }]}>Completato</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[kitStyles.kitXpText, { color: "#38BDF8" }]}>+{kit.rewardXp}</Text>
                      <XpIcon size={20} />
                    </>
                  )}
                </View>
              </View>

              <View style={kitStyles.slotsRow}>
                {kit.slots.map((slot) => (
                  <View key={slot.id} style={[kitStyles.slot, { backgroundColor: slot.completed ? (mode === "dark" ? "#1E3328" : "#D1FAE5") : theme.cardAlt, borderColor: slot.completed ? theme.leaf : theme.border }]}>
                    {slot.completed ? (
                      <Feather name="check-circle" size={13} color={theme.leaf} />
                    ) : (
                      <Feather name="circle" size={13} color={theme.textMuted} />
                    )}
                    <Text style={[kitStyles.slotLabel, { color: slot.completed ? theme.leaf : theme.textSecondary }]} numberOfLines={1}>
                      {slot.label}
                    </Text>
                  </View>
                ))}
              </View>

              {!kit.isCompleted && (
                <>
                  <View style={[kitStyles.kitProgressTrack, { backgroundColor: theme.border }]}>
                    <View style={[kitStyles.kitProgressFill, { width: `${kit.progressPercent}%`, backgroundColor: theme.leaf }]} />
                  </View>
                  <Text style={[kitStyles.kitProgressText, { color: theme.textMuted }]}>
                    {kit.completedCount}/{kit.totalCount} prodotti
                  </Text>
                </>
              )}
            </View>
          ))}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="award" size={18} color={theme.leaf} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Collezione Badge</Text>
        </View>

        <View style={[styles.tabSwitcher, { backgroundColor: theme.cardAlt }]}>
          <Pressable
            style={[styles.tab, badgeTab === "traguardi" && [styles.tabActive, { backgroundColor: theme.card }]]}
            onPress={() => setBadgeTab("traguardi")}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.textSecondary },
                badgeTab === "traguardi" && [styles.tabTextActive, { color: theme.leaf }],
              ]}
            >
              Traguardi
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, badgeTab === "sfide" && [styles.tabActive, { backgroundColor: theme.card }]]}
            onPress={() => setBadgeTab("sfide")}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.textSecondary },
                badgeTab === "sfide" && [styles.tabTextActive, { color: theme.leaf }],
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
                <LifetimeBadgeCard key={badge.id} badge={badge} theme={theme} />
              ))
            ) : (
              <View style={styles.emptyBadges}>
                <Feather name="award" size={28} color={theme.textMuted} />
                <Text style={[styles.emptyBadgesText, { color: theme.textSecondary }]}>
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
                  <Feather name="clock" size={12} color={theme.leaf} />
                  <Text style={[styles.temporalSectionTitle, { color: theme.text }]}>Attive</Text>
                </View>
                <View style={styles.badgeGrid}>
                  {activeTemporal.map((badge, i) => (
                    <TemporalBadgeCard
                      key={`${badge.id}-${badge.periodKey}-${i}`}
                      badge={badge}
                      theme={theme}
                    />
                  ))}
                </View>
              </View>
            )}

            {archivedTemporal.length > 0 && (
              <View>
                <Text style={[styles.archivedSectionTitle, { color: theme.textMuted }]}>Archivio</Text>
                <View style={styles.archivedGrid}>
                  {archivedTemporal.map((badge, i) => (
                    <TemporalBadgeCard
                      key={`${badge.id}-${badge.periodKey}-${i}`}
                      badge={badge}
                      compact
                      theme={theme}
                    />
                  ))}
                </View>
              </View>
            )}

            {activeTemporal.length === 0 && archivedTemporal.length === 0 && (
              <View style={styles.emptyBadges}>
                <Feather name="target" size={28} color={theme.textMuted} />
                <Text style={[styles.emptyBadgesText, { color: theme.textSecondary }]}>
                  Le sfide a tempo appariranno qui.
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320).springify()} style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Impostazioni</Text>

        <Pressable
          style={[styles.menuRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={toggleTheme}
        >
          <View style={[styles.menuRowIcon, { backgroundColor: theme.primaryLight }]}>
            <Feather name={mode === "dark" ? "sun" : "moon"} size={18} color={theme.leaf} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuRowText, { color: theme.text }]}>Tema</Text>
            <Text style={[styles.menuRowSub, { color: theme.textSecondary }]}>{mode === "dark" ? "Scuro" : "Chiaro"}</Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        </Pressable>

        <Pressable style={[styles.menuRow, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push("/support")}>
          <View style={[styles.menuRowIcon, { backgroundColor: theme.primaryLight }]}>
            <Feather name="help-circle" size={18} color={theme.leaf} />
          </View>
          <Text style={[styles.menuRowText, { color: theme.text }]}>Aiuto e Supporto / FAQ</Text>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        </Pressable>

        {!hasLeafyGold ? (
          <Pressable style={[styles.menuRow, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setShowLeafyGoldModal(true)}>
            <View style={[styles.menuRowIcon, { backgroundColor: "rgba(255,215,0,0.15)" }]}>
              <Image source={require("@/assets/images/leafy-gold-icon.png")} style={{ width: 22, height: 22 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuRowText, { color: theme.text }]}>Leafy Gold</Text>
              <Text style={[styles.menuRowSub, { color: theme.textSecondary }]}>x2 $LEA · Preleva su PayPal</Text>
            </View>
            <View style={styles.menuRowBadge}>
              <Text style={styles.menuRowBadgeText}>0,89€/mese</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.menuRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.menuRowIcon, { backgroundColor: "rgba(255,215,0,0.15)" }]}>
              <Image source={require("@/assets/images/leafy-gold-icon.png")} style={{ width: 22, height: 22 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuRowText, { color: theme.text }]}>Leafy Gold</Text>
              <Text style={[styles.menuRowSub, { color: theme.textSecondary }]}>Attivo · $LEA x2</Text>
            </View>
            <View style={[styles.menuRowBadge, { backgroundColor: "#4ade80" }]}>
              <Text style={[styles.menuRowBadgeText, { color: "#fff" }]}>Attivo</Text>
            </View>
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
            <ActivityIndicator color={theme.red} />
          ) : (
            <>
              <Feather name="log-out" size={18} color={theme.red} />
              <Text style={styles.logoutText}>Esci dall'account</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
    </>
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
    paddingBottom: 80,
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
    marginTop: -52,
    backgroundColor: Colors.card,
    borderRadius: 24,
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    zIndex: 10,
  },
  avatarContainer: {
    position: "relative",
    marginTop: -50,
    marginBottom: 14,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    gap: 10,
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

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRowText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  menuRowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  menuRowBadge: {
    backgroundColor: "#FFD700",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  menuRowBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },
});

const kitStyles = StyleSheet.create({
  kitCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  kitHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  kitName: {
    fontSize: 15,
    fontFamily: "DMSans_700Bold",
  },
  kitDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  kitXpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  kitXpText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  slotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: "48%",
  },
  slotLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  kitProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  kitProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  kitProgressText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  multiplierBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  multiplierTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  multiplierSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
