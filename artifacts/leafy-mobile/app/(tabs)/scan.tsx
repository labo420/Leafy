import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn, FadeInDown, SlideInDown,
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import { getProductEmoji } from "@/constants/emojis";
import { useAuth } from "@/context/auth";
import { useLevelUp } from "@/context/level-up";
import { useScanReset } from "@/context/scan-reset";
import { useTheme } from "@/context/theme";
import { router } from "expo-router";
import type { Profile } from "@workspace/api-client-react";

interface AcceptedStoresData {
  standard: string[];
  bio: string[];
  discount: string[];
}

interface PendingProduct {
  name: string;
  matched: boolean;
  barcode: string | null;
  ecoScore: string | null;
  points: number;
  emoji: string | null;
  category: string | null;
}

interface ScanResponse {
  receiptId: number;
  barcodeExpiry: string;
  storeName: string | null;
  message: string;
  sessionHours: number;
  greenItemsFound: PendingProduct[];
  receiptBonusPts?: number;
  welcomeBonus?: boolean;
  welcomeBonusPts?: number;
  xpEarned?: number;
  leaEarned?: number;
}

interface ActiveSession {
  active: boolean;
  receipt: {
    id: number;
    storeName: string | null;
    scannedAt: string;
    barcodeExpiry: string;
    pointsEarned: number;
    greenItemsCount: number;
    greenItems: PendingProduct[];
  } | null;
  remainingMinutes: number;
  barcodeScans: Array<{
    id: number;
    barcode: string;
    productName: string;
    ecoScore: string | null;
    pointsEarned: number;
    category: string;
    emoji: string;
  }>;
}

type ScanState = "idle" | "preview" | "scanning" | "confirmed";

function formatTimeRemaining(minutes: number): string {
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }
  return `${minutes} min`;
}

function getMotivationMessage(xp: number): string {
  if (xp === 0) return "Ottimo! Hai guadagnato i punti base per questo scontrino.";
  if (xp < 20) return `Bel colpo! Hai accumulato ${xp} XP con questo scontrino.`;
  if (xp < 50) return `Ottimo lavoro! ${xp} XP aggiunti al tuo profilo.`;
  if (xp < 100) return `Fantastico! ${xp} XP — stai diventando un campione del verde!`;
  return `Incredibile! ${xp} XP in un solo scontrino. Sei un eroe della sostenibilità!`;
}

function AcceptedStoresSection() {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const { data } = useQuery<AcceptedStoresData>({
    queryKey: ["accepted-stores"],
    queryFn: () => apiFetch("/accepted-stores"),
  });

  if (!data) return null;

  return (
    <View style={styles.storesSection}>
      <Pressable style={styles.storesToggle} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel="Negozi accettati" accessibilityState={{ expanded: open }}>
        <View style={styles.storesToggleLeft}>
          <Feather name="shopping-bag" size={16} color={theme.textSecondary} />
          <Text style={[styles.storesToggleText, { color: theme.textSecondary }]}>Negozi accettati</Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
      </Pressable>
      {open && (
        <View style={[styles.storesList, { backgroundColor: theme.card }]}>
          <View style={styles.storesCategory}>
            <Text style={[styles.storesCatTitle, { color: theme.text }]}>Supermercati</Text>
            <Text style={[styles.storesCatList, { color: theme.textSecondary }]}>{data.standard.join(", ")}</Text>
          </View>
          <View style={styles.storesCategory}>
            <Text style={[styles.storesCatTitle, { color: theme.text }]}>Bio / Naturale</Text>
            <Text style={[styles.storesCatList, { color: theme.textSecondary }]}>{data.bio.join(", ")}</Text>
          </View>
          <View style={styles.storesCategory}>
            <Text style={[styles.storesCatTitle, { color: theme.text }]}>Discount</Text>
            <Text style={[styles.storesCatList, { color: theme.textSecondary }]}>{data.discount.join(", ")}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function HowItWorksSection() {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  return (
    <View style={styles.howSection}>
      <Pressable style={styles.howToggle} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel="Come funziona" accessibilityState={{ expanded: open }}>
        <View style={styles.howToggleLeft}>
          <Feather name="help-circle" size={16} color={theme.textSecondary} />
          <Text style={[styles.howToggleText, { color: theme.textSecondary }]}>Come funziona</Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.howSteps}>
          {[
            { icon: "file-text" as const, text: "Fotografa lo scontrino" },
            { icon: "maximize" as const, text: "Scansiona i codici a barre dei prodotti" },
            { icon: "award" as const, text: "Guadagna punti in base al Punteggio Verde" },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: theme.primaryLight }]}>
                <Feather name={step.icon} size={15} color={theme.leaf} />
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshBalances, hasBattlePass } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanState>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const { checkForLevelUp } = useLevelUp();
  const { registerReset, registerCamera } = useScanReset();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;
  const scanStateRef = useRef(state);
  const activeSessionRef = useRef<ActiveSession | undefined>(undefined);
  const cameraScale = useSharedValue(1);
  const cameraAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

  const [displayXp, setDisplayXp] = useState(0);
  const barFill = useSharedValue(0);
  const barAnimStyle = useAnimatedStyle(() => ({
    width: `${barFill.value * 100}%` as any,
  }));

  useEffect(() => {
    if (state !== "confirmed" || !scanResult) return;
    const target = scanResult.xpEarned ?? 0;
    setDisplayXp(0);
    barFill.value = 0;
    const steps = 30;
    const duration = 750;
    const intervalMs = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(target, current + Math.max(1, Math.ceil(target / steps)));
      setDisplayXp(current);
      if (current >= target) clearInterval(timer);
    }, intervalMs);
    barFill.value = withDelay(200, withSpring(Math.min(1, target / 100), { damping: 18, stiffness: 65 }));
    return () => clearInterval(timer);
  }, [state, scanResult?.xpEarned]);

  const { data: activeSession, isLoading: sessionLoading } = useQuery<ActiveSession>({
    queryKey: ["active-session"],
    queryFn: () => apiFetch("/scan/active-session"),
    enabled: !!user,
    refetchInterval: 60000,
  });

  useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: !!user,
  });

  const scanMutation = useMutation({
    mutationFn: (imageBase64: string) =>
      apiFetch<ScanResponse>("/scan", {
        method: "POST",
        body: JSON.stringify({ imageBase64 }),
      }),
    onSuccess: async (data) => {
      setScanResult(data);
      setState("confirmed");
      if (data.welcomeBonus) {
        setShowWelcomeOverlay(true);
        setTimeout(() => setShowWelcomeOverlay(false), 3500);
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["active-session"] });
      refreshBalances();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      checkForLevelUp();
    },
    onError: (err: Error) => {
      Alert.alert("Errore", err.message ?? "Impossibile validare lo scontrino");
      setState("preview");
    },
  });

  const pickImage = async () => {
    if (!user) {
      router.push("/(tabs)");
      return;
    }
    try {
      const { granted, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Fotocamera non autorizzata",
          canAskAgain
            ? "Leafy ha bisogno della fotocamera per scansionare gli scontrini."
            : "Hai negato l'accesso alla fotocamera. Abilitalo nelle impostazioni del dispositivo.",
          [
            { text: "Non ora", style: "cancel" },
            { text: "Apri Impostazioni", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8, mediaTypes: "images" });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 ?? null);
        setState("preview");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      Alert.alert("Errore fotocamera", "Impossibile accedere alla fotocamera. Controlla i permessi nelle impostazioni.");
    }
  };

  const pickImageRef = useRef(pickImage);
  pickImageRef.current = pickImage;

  const startScan = () => {
    if (!imageBase64) return;
    setState("scanning");
    scanMutation.mutate(imageBase64);
  };

  const reset = () => {
    setState("idle");
    scanStateRef.current = "idle";
    setImageUri(null);
    setImageBase64(null);
    setScanResult(null);
  };

  useEffect(() => {
    scanStateRef.current = state;
  }, [state]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    registerReset(reset);
    registerCamera(() => {
      if (scanStateRef.current === "idle" && !activeSessionRef.current?.active) {
        pickImageRef.current();
      }
    });
  }, []);

  const openBarcodeScanner = (receiptId: number, productName?: string) => {
    const params: Record<string, string> = { receiptId: String(receiptId) };
    if (productName) params.productName = productName;
    router.push({ pathname: "/barcode-scanner", params });
  };

  const cancelSession = async () => {
    try {
      await apiFetch("/scan/cancel-session", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["active-session"] });
      setScanResult(null);
      setState("idle");
    } catch (err) {
      Alert.alert("Errore", "Impossibile cancellare la sessione");
    }
  };

  if (state === "confirmed" && scanResult) {
    const allItems = (scanResult.greenItemsFound ?? []);
    const idoneiUnmatched = allItems.filter(p => p.points > 0 && !p.matched);
    const idoneiMatched = allItems.filter(p => p.points > 0 && p.matched);
    const nonIdonei = allItems.filter(p => p.points === 0);
    const totalIdonei = idoneiUnmatched.length + idoneiMatched.length;
    const hasUnscanned = idoneiUnmatched.length > 0;

    const goToStorico = () => {
      router.navigate({ pathname: "/(tabs)/storico", params: { openReceiptId: String(scanResult.receiptId) } });
      reset();
    };

    return (
        <>
          <Modal visible={showWelcomeOverlay} transparent animationType="fade">
            <View style={styles.welcomeOverlayBg}>
              <Animated.View entering={FadeIn} style={[styles.welcomeOverlayCard, { backgroundColor: theme.card }]}>
                <Feather name="star" size={48} color={theme.amber} style={{ marginBottom: 16 }} />
                <Text style={[styles.welcomeOverlayTitle, { color: theme.forest }]}>Benvenuto su Leafy!</Text>
                <Text style={[styles.welcomeOverlayText, { color: theme.text }]}>Hai ricevuto +{scanResult.welcomeBonusPts} punti per il tuo primo scontrino eco-friendly</Text>
              </Animated.View>
            </View>
          </Modal>
          <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: bottomPad }}>
            <LinearGradient
              colors={[theme.forest, theme.leaf]}
              style={[styles.resultHeader, { paddingTop: topPadding + 16 }]}
            >
              <Animated.View entering={FadeIn.delay(100)}>
                <View style={styles.resultIconWrap}>
                  <Feather name="check-circle" size={48} color="#fff" />
                </View>
                <Text style={styles.resultTitle}>Scontrino verificato!</Text>
                <Text style={styles.resultSub}>{scanResult.message}</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(150)} style={styles.infoBadges}>
                {scanResult.storeName && (
                  <Text style={styles.storeNameBadge}>🏪 {scanResult.storeName}</Text>
                )}
                {!scanResult.welcomeBonus && (scanResult.receiptBonusPts ?? 0) > 0 && (
                  <View style={styles.bonusChip}>
                    <Text style={styles.bonusChipEmoji}>📷</Text>
                    <Text style={styles.bonusChipText}>Scontrino +{scanResult.receiptBonusPts} pt</Text>
                  </View>
                )}
                <View style={styles.timerBox}>
                  <Feather name="clock" size={18} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.timerText}>
                    Hai {scanResult.sessionHours} ore per scansionare i barcode
                  </Text>
                </View>
              </Animated.View>
            </LinearGradient>

            <Animated.View entering={FadeInDown.delay(220)} style={[styles.xpHeroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.xpBigValue, { color: theme.leaf }]}>+{displayXp} XP</Text>
              <Text style={[styles.xpMotivation, { color: theme.text }]}>{getMotivationMessage(scanResult.xpEarned ?? 0)}</Text>
              <View style={[styles.xpBarTrack, { backgroundColor: theme.border }]}>
                <Animated.View
                  style={[
                    styles.xpBarFill,
                    barAnimStyle,
                    { backgroundColor: (scanResult.xpEarned ?? 0) >= 50 ? Colors.amber : theme.leaf },
                  ]}
                />
              </View>
              <Text style={[styles.xpBarLabel, { color: theme.textMuted }]}>
                {scanResult.xpEarned ?? 0} / 100 XP
              </Text>
              <View style={styles.leaSecondaryRow}>
                <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                <Text style={[styles.leaSecondaryText, { color: theme.textSecondary }]}>
                  +{(scanResult.leaEarned ?? 0).toFixed(2)} $LEA guadagnati
                </Text>
                {hasBattlePass && (
                  <View style={styles.x2Badge}>
                    <Text style={styles.x2BadgeText}>x2</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {totalIdonei > 0 && (
              <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                <Text style={[styles.pendingTitle, { color: theme.text }]}>Prodotti idonei ({totalIdonei})</Text>
                {idoneiUnmatched.map((product, i) => (
                  <View key={`iu-${i}`} style={[styles.pendingProductRow, { backgroundColor: theme.card }]}>
                    <Text style={styles.productEmoji}>{getProductEmoji(product.name, product.category, product.emoji)}</Text>
                    <Text style={[styles.pendingProductName, { color: theme.text }]} numberOfLines={1}>{product.name}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.scanProductMiniBtn, { backgroundColor: theme.leaf }, pressed && { opacity: 0.75 }]}
                      onPress={() => openBarcodeScanner(scanResult.receiptId, product.name)}
                    >
                      <Text style={styles.scanProductMiniBtnText}>Scansiona</Text>
                    </Pressable>
                  </View>
                ))}
                {idoneiMatched.map((product, i) => (
                  <View key={`im-${i}`} style={[styles.pendingProductRow, { backgroundColor: theme.card, opacity: 0.6 }]}>
                    <Text style={styles.productEmoji}>{getProductEmoji(product.name, product.category, product.emoji)}</Text>
                    <Text style={[styles.pendingProductName, { flex: 1, color: theme.text }]} numberOfLines={1}>{product.name}</Text>
                    <View style={[styles.verifiedInlineBadge, { backgroundColor: theme.primaryLight }]}>
                      <Feather name="check" size={12} color={theme.leaf} />
                      <Text style={[styles.verifiedInlineText, { color: theme.leaf }]}>+{product.points} pt</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}

            {nonIdonei.length > 0 && (
              <Animated.View entering={FadeInDown.delay(350)} style={[styles.section, styles.nonGreenSection, { backgroundColor: theme.background }]}>
                <View style={styles.nonGreenTitleRow}>
                  <Feather name="shopping-bag" size={13} color={theme.textSecondary} />
                  <Text style={[styles.nonGreenTitle, { color: theme.textSecondary }]}>Altri prodotti ({nonIdonei.length})</Text>
                </View>
                {nonIdonei.map((product, i) => (
                  <View key={`ni-${i}`} style={styles.nonGreenRow}>
                    <Text style={styles.productEmoji}>{getProductEmoji(product.name, product.category, product.emoji)}</Text>
                    <Text style={[styles.nonGreenName, { color: theme.textSecondary }]} numberOfLines={1}>{product.name}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(400)} style={[styles.radarTipCard, { borderColor: theme.amber }]}>
              <View style={styles.radarTipHeader}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={theme.amber} />
                <Text style={[styles.radarTipTitle, { color: theme.amber }]}>Consiglio del Radar</Text>
              </View>
              <Text style={[styles.radarTipText, { color: theme.text }]}>
                {nonIdonei.length > 0
                  ? `Sapevi che scegliendo un'alternativa Eco per ${nonIdonei[0].name} avresti guadagnato +15 $LEA? Tienilo a mente!`
                  : [
                      "Scansiona i barcode dei prodotti idonei per guadagnare ancora più $LEA.",
                      "Prodotti con Eco-Score A o B valgono il doppio in punti.",
                      "Con il Battle Pass ogni $LEA guadagnato viene raddoppiato automaticamente.",
                      "Più scansioni fai ogni mese, più sali di livello e sblocchi badge esclusivi.",
                      "I prodotti bio e a km0 ottengono un bonus punti aggiuntivo.",
                    ][scanResult.receiptId % 5]
                }
              </Text>
            </Animated.View>

            <View style={styles.section}>
              <Pressable style={styles.scanProductsBtn} onPress={goToStorico}>
                <LinearGradient
                  colors={[theme.leaf, theme.forest]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.scanProductsBtnGrad}
                >
                  <Feather name="arrow-right" size={28} color="#fff" />
                  <Text style={styles.scanProductsBtnTitle}>
                    {hasUnscanned ? "Continua nello storico" : "Vedi riepilogo nello storico"}
                  </Text>
                  <Text style={styles.scanProductsBtnSub}>
                    {hasUnscanned
                      ? "Scansiona i barcode dei prodotti idonei"
                      : "Visualizza il riepilogo completo dello scontrino"
                    }
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.resetBtn} onPress={cancelSession}>
                <Text style={styles.resetBtnText}>Cancella e ricomincia</Text>
              </Pressable>
            </View>
          </ScrollView>
        </>
    );
  }

  if (state === "scanning") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding, backgroundColor: theme.background }]}>
        <LinearGradient colors={[theme.primaryLight, theme.background]} style={StyleSheet.absoluteFill} />
        {imageUri && <Image source={{ uri: imageUri }} style={styles.scanningImage} />}
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color={theme.leaf} />
          <Text style={[styles.scanningText, { color: theme.text }]}>Verifica in corso...</Text>
          <Text style={[styles.scanningSubText, { color: theme.textSecondary }]}>Controllo anti-frode sullo scontrino</Text>
        </View>
      </View>
    );
  }

  if (state === "preview" && imageUri) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]}>
        <View style={styles.previewHeader}>
          <Pressable onPress={reset}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.previewTitle, { color: theme.text }]}>Scontrino</Text>
          <View style={{ width: 24 }} />
        </View>
        <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        <Animated.View entering={SlideInDown.springify()} style={[styles.previewActions, { paddingBottom: bottomPad / 2 }]}>
          <Pressable style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.leaf }]} onPress={() => pickImage()}>
            <Feather name="camera" size={18} color={theme.leaf} />
            <Text style={[styles.secondaryBtnText, { color: theme.leaf }]}>Cambia</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, { backgroundColor: theme.leaf }]} onPress={startScan}>
            <Feather name="zap" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Conferma</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  if (activeSession?.active && activeSession.receipt) {
    const r = activeSession.receipt;
    const pendingItems = (r.greenItems ?? []).filter(p => !p.matched);
    const confirmedItems = activeSession.barcodeScans;

    return (
        <ScrollView style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: bottomPad }}>
          <View style={styles.idleHeader}>
            <Text style={[styles.idleTitle, { color: theme.text }]}>In sospeso</Text>
            <Text style={[styles.idleSub, { color: theme.textSecondary }]}>
              Scansiona i prodotti per guadagnare i tuoi punti
            </Text>
          </View>

          <View style={[styles.activeSessionCard, { backgroundColor: theme.card }]}>
            <View style={styles.activeSessionTop}>
              <View>
                <Text style={[styles.activeStoreName, { color: theme.text }]}>{r.storeName ?? "Negozio"}</Text>
                <View style={styles.activeTimerRow}>
                  <Feather name="clock" size={14} color={theme.textSecondary} />
                  <Text style={[styles.activeTimerText, { color: theme.textSecondary }]}>
                    {formatTimeRemaining(activeSession.remainingMinutes)} rimasti
                  </Text>
                </View>
              </View>
              <View style={[styles.activePointsBadge, { backgroundColor: theme.primaryLight }]}>
                <Feather name="feather" size={14} color={theme.leaf} />
                <Text style={[styles.activePointsText, { color: theme.leaf }]}>{r.pointsEarned} pt</Text>
              </View>
            </View>

            {pendingItems.length > 0 && (
              <View style={styles.scannedList}>
                <Text style={[styles.scannedListTitle, { color: theme.text }]}>
                  Da verificare ({pendingItems.length})
                </Text>
                {pendingItems.map((p, i) => (
                  <View key={i} style={[styles.pendingProductRow, { backgroundColor: theme.background }]}>
                    <View style={[styles.pendingProductIcon, { backgroundColor: theme.cardAlt }]}>
                      <MaterialCommunityIcons name="barcode-scan" size={16} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.pendingProductName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.scanProductMiniBtn, { backgroundColor: theme.leaf }, pressed && { opacity: 0.75 }]}
                      onPress={() => openBarcodeScanner(r.id, p.name)}
                    >
                      <Text style={styles.scanProductMiniBtnText}>Scansiona</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {confirmedItems.length > 0 && (
              <View style={styles.scannedList}>
                <Text style={[styles.scannedListTitle, { color: theme.text }]}>
                  Verificati ({confirmedItems.length})
                </Text>
                {confirmedItems.map((s) => (
                  <View key={s.id} style={[styles.scannedItem, { backgroundColor: theme.background }]}>
                    <Text style={styles.scannedEmoji}>{s.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scannedName, { color: theme.text }]} numberOfLines={1}>{s.productName}</Text>
                      <Text style={[styles.scannedCat, { color: theme.textSecondary }]}>{s.category}</Text>
                    </View>
                    <Text style={[styles.scannedPts, { color: theme.leaf }]}>+{s.pointsEarned}</Text>
                  </View>
                ))}
              </View>
            )}

            {pendingItems.length === 0 && confirmedItems.length === 0 && (
              <Pressable
                style={styles.scanProductsBtn}
                onPress={() => openBarcodeScanner(r.id)}
              >
                <LinearGradient
                  colors={[theme.leaf, theme.forest]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.scanProductsBtnGrad}
                >
                  <MaterialCommunityIcons name="barcode-scan" size={28} color="#fff" />
                  <Text style={styles.scanProductsBtnTitle}>Scansiona Prodotti</Text>
                  <Text style={styles.scanProductsBtnSub}>Inquadra i codici a barre</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.orText, { color: theme.textSecondary }]}>oppure</Text>
            <Pressable style={[styles.newReceiptBtn, { backgroundColor: theme.card, borderColor: theme.leaf }]} onPress={() => pickImage()}>
              <Feather name="camera" size={18} color={theme.leaf} />
              <Text style={[styles.newReceiptBtnText, { color: theme.leaf }]}>Scansiona un nuovo scontrino</Text>
            </Pressable>
          </View>
        </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]}
      contentContainerStyle={[styles.idleContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.idleHeader}>
        <Text style={[styles.idleTitle, { color: theme.text }]}>Scansiona</Text>
        <View style={styles.idleSubRow}>
          <Feather name="feather" size={14} color={theme.leaf} />
          <Text style={[styles.idleSub, { color: theme.textSecondary }]}>Guadagna punti per ogni acquisto sostenibile</Text>
        </View>
      </View>

      {sessionLoading ? (
        <ActivityIndicator size="large" color={theme.leaf} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.actionCardsSection}>
            <Pressable
              onPressIn={() => { cameraScale.value = withSpring(0.97, { damping: 15, stiffness: 250 }); }}
              onPressOut={() => { cameraScale.value = withSpring(1, { damping: 10, stiffness: 180 }); }}
              onPress={() => pickImage()}
              accessibilityRole="button"
              accessibilityLabel="Fotografa lo scontrino"
            >
              <Animated.View style={cameraAnimStyle}>
                <LinearGradient
                  colors={["#3a8f65", theme.leaf, "#245a42"]}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.receiptCard}
                >
                  <View style={styles.receiptCardIcon}>
                    <Feather name="camera" size={32} color="#fff" />
                  </View>
                  <View style={styles.receiptCardText}>
                    <Text style={styles.receiptCardTitle}>Fotografa Scontrino</Text>
                    <Text style={styles.receiptCardSub}>Scatta una foto per verificare la spesa</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
                </LinearGradient>
              </Animated.View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionCardWide, { backgroundColor: theme.card, borderColor: theme.border }, pressed && { opacity: 0.85 }]}
              onPress={() => {
                if (!user) { router.push("/(tabs)"); return; }
                router.push("/shopping-scanner");
              }}
            >
              <View style={[styles.actionCardSmallIcon, { backgroundColor: theme.primaryLight }]}>
                <MaterialCommunityIcons name="cart-outline" size={22} color={theme.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionCardSmallTitle, { color: theme.text }]}>Modalità Spesa</Text>
                <Text style={[styles.actionCardSmallSub, { color: theme.textSecondary }]}>Scansiona i barcode dei prodotti</Text>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            <View style={styles.scanHint}>
              <Feather name="info" size={13} color={theme.textSecondary} />
              <Text style={[styles.scanHintText, { color: theme.textSecondary }]}>Assicurati che totale e data siano leggibili</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <HowItWorksSection />
            <AcceptedStoresSection />
          </Animated.View>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  idleContent: { flexGrow: 1 },
  centered: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center",
  },

  idleHeader: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  idleTitle: { fontSize: 26, fontFamily: "DMSans_700Bold", color: Colors.text, marginBottom: 4 },
  idleSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  idleSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  actionCardsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  receiptCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  receiptCardIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCardText: {
    flex: 1,
  },
  receiptCardTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    marginBottom: 2,
  },
  receiptCardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionCardSmall: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardSmallIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  actionCardSmallTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  actionCardSmallSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },

  scanHint: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 4,
  },
  scanHintText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, textAlign: "center", flexShrink: 1,
  },

  howSection: { paddingHorizontal: 20, marginTop: 8 },
  howToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14,
  },
  howToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  howToggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  howSteps: { gap: 10, paddingBottom: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: {
    width: 32, height: 32, borderRadius: 24, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  stepText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  previewHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  previewTitle: { fontSize: 18, fontFamily: "DMSans_600SemiBold", color: Colors.text },
  previewImage: { flex: 1, width: "100%" },
  previewActions: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.leaf, borderRadius: 24, paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.card, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: Colors.leaf,
  },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.leaf },
  scanningImage: { width: "90%", height: "60%", borderRadius: 24, opacity: 0.4 },
  scanningOverlay: { position: "absolute", alignItems: "center", gap: 12 },
  scanningText: { fontSize: 22, fontFamily: "DMSans_700Bold", color: Colors.text, marginTop: 12 },
  scanningSubText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  resultHeader: {
    paddingHorizontal: 24, paddingBottom: 32,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, alignItems: "center",
  },
  resultIconWrap: { alignItems: "center", marginBottom: 12 },
  resultTitle: { fontSize: 28, fontFamily: "DMSans_700Bold", color: "#fff", textAlign: "center", marginBottom: 4 },
  resultSub: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)",
    textAlign: "center", lineHeight: 22, marginBottom: 12,
  },
  infoBadges: {
    gap: 10, alignItems: "center", marginTop: 12,
  },
  bonusRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center",
  },
  bonusChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  bonusChipEmoji: { fontSize: 16 },
  bonusChipText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  storeNameBadge: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 16,
    overflow: "hidden",
  },
  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  welcomeOverlayBg: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center",
  },
  welcomeOverlayCard: {
    backgroundColor: "#fff", borderRadius: 28, padding: 32, alignItems: "center", width: "80%",
  },
  welcomeOverlayTitle: { fontSize: 28, fontFamily: "DMSans_700Bold", color: Colors.forest, marginBottom: 12, textAlign: "center" },
  welcomeOverlayText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, textAlign: "center", lineHeight: 22 },
  productEmoji: { fontSize: 18, marginRight: 4, width: 24 },
  nonGreenSection: { backgroundColor: Colors.background, borderRadius: 12, paddingVertical: 12 },
  nonGreenTitleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8, paddingHorizontal: 4 },
  nonGreenTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  nonGreenRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  nonGreenName: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  timerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  scanProductsBtn: { borderRadius: 24, overflow: "hidden" },
  scanProductsBtnGrad: { padding: 24, alignItems: "center", gap: 8 },
  scanProductsBtnTitle: { fontSize: 20, fontFamily: "DMSans_700Bold", color: "#fff" },
  scanProductsBtnSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  verifiedInlineBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  verifiedInlineText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.leaf },
  resetBtn: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  resetBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textDecorationLine: "underline" },

  pendingTitle: {
    fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text,
    marginBottom: 12,
  },
  pendingProductRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  pendingProductIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.background, alignItems: "center", justifyContent: "center",
  },
  pendingProductName: {
    flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text,
  },
  scanProductMiniBtn: {
    backgroundColor: Colors.leaf, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  scanProductMiniBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff",
  },
  matchedHint: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary,
    textAlign: "center", marginTop: 4,
  },
  activeSessionCard: { marginHorizontal: 20, backgroundColor: Colors.card, borderRadius: 24, padding: 16, gap: 16 },
  activeSessionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeStoreName: { fontSize: 18, fontFamily: "DMSans_700Bold", color: Colors.text },
  activeTimerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  activeTimerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  activePointsBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  activePointsText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf },
  scannedList: { gap: 8 },
  scannedListTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 4 },
  scannedItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
  },
  scannedEmoji: { fontSize: 20 },
  scannedName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  scannedCat: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  scannedPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf },
  orText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center", marginBottom: 12 },
  newReceiptBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.card, borderRadius: 24, paddingVertical: 16,
    borderWidth: 1.5, borderColor: Colors.leaf,
  },
  newReceiptBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.leaf },
  storesSection: { paddingHorizontal: 20, marginTop: 0, marginBottom: 8 },
  storesToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14,
  },
  storesToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  storesToggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  storesList: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 16, gap: 16,
  },
  storesCategory: { gap: 4 },
  storesCatTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  storesCatList: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },

  xpHeroCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  xpBigValue: {
    fontSize: 56,
    fontFamily: "DMSans_700Bold",
    color: Colors.leaf,
    lineHeight: 64,
    textAlign: "center",
  },
  xpMotivation: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "center",
    lineHeight: 22,
  },
  xpBarTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 14,
  },
  xpBarFill: {
    height: 8,
    borderRadius: 4,
  },
  xpBarLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  leaSecondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  leaSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  x2Badge: {
    backgroundColor: "#FFD700",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  x2BadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },

  radarTipCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF8EC",
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.amber,
  },
  radarTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radarTipTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.amber,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  radarTipText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },

  actionCardWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
