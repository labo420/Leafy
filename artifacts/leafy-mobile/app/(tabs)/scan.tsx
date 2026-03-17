import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  useSharedValue, useAnimatedStyle, withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import { getProductEmoji } from "@/constants/emojis";
import { useAuth } from "@/context/auth";
import { useLevelUp } from "@/context/level-up";
import { useScanReset } from "@/context/scan-reset";
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


function AcceptedStoresSection() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<AcceptedStoresData>({
    queryKey: ["accepted-stores"],
    queryFn: () => apiFetch("/accepted-stores"),
  });

  if (!data) return null;

  return (
    <View style={styles.storesSection}>
      <Pressable style={styles.storesToggle} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel="Negozi accettati" accessibilityState={{ expanded: open }}>
        <View style={styles.storesToggleLeft}>
          <Feather name="shopping-bag" size={16} color={Colors.textSecondary} />
          <Text style={styles.storesToggleText}>Negozi accettati</Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.storesList}>
          <View style={styles.storesCategory}>
            <Text style={styles.storesCatTitle}>Supermercati</Text>
            <Text style={styles.storesCatList}>{data.standard.join(", ")}</Text>
          </View>
          <View style={styles.storesCategory}>
            <Text style={styles.storesCatTitle}>Bio / Naturale</Text>
            <Text style={styles.storesCatList}>{data.bio.join(", ")}</Text>
          </View>
          <View style={styles.storesCategory}>
            <Text style={styles.storesCatTitle}>Discount</Text>
            <Text style={styles.storesCatList}>{data.discount.join(", ")}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function HowItWorksSection() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.howSection}>
      <Pressable style={styles.howToggle} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel="Come funziona" accessibilityState={{ expanded: open }}>
        <View style={styles.howToggleLeft}>
          <Feather name="help-circle" size={16} color={Colors.textSecondary} />
          <Text style={styles.howToggleText}>Come funziona</Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.howSteps}>
          {[
            { icon: "file-text" as const, text: "Fotografa lo scontrino" },
            { icon: "maximize" as const, text: "Scansiona i codici a barre dei prodotti" },
            { icon: "award" as const, text: "Guadagna punti in base al Punteggio Verde" },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Feather name={step.icon} size={15} color={Colors.leaf} />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
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
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanState>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const { checkForLevelUp } = useLevelUp();
  const { registerReset } = useScanReset();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;
  const cameraScale = useSharedValue(1);
  const cameraAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

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

  const pickImage = async (source: "camera" | "gallery") => {
    if (!user) {
      router.push("/(tabs)");
      return;
    }
    let result;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso negato", "Abilita l'accesso alla fotocamera nelle impostazioni");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8, mediaTypes: "images" });
    } else {
      const mediaPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPerm.granted) {
        Alert.alert("Permesso negato", "Abilita l'accesso alla galleria nelle impostazioni");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, mediaTypes: "images" });
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setState("preview");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const startScan = () => {
    if (!imageBase64) return;
    setState("scanning");
    scanMutation.mutate(imageBase64);
  };

  const reset = () => {
    setState("idle");
    setImageUri(null);
    setImageBase64(null);
    setScanResult(null);
  };

  useEffect(() => {
    registerReset(reset);
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
              <Animated.View entering={FadeIn} style={styles.welcomeOverlayCard}>
                <Text style={styles.welcomeOverlayEmoji}>🎉</Text>
                <Text style={styles.welcomeOverlayTitle}>Benvenuto su Leafy!</Text>
                <Text style={styles.welcomeOverlayText}>Hai ricevuto +{scanResult.welcomeBonusPts} punti per il tuo primo scontrino eco-friendly</Text>
              </Animated.View>
            </View>
          </Modal>
          <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: bottomPad }}>
            <LinearGradient
              colors={[Colors.forest, Colors.leaf]}
              style={[styles.resultHeader, { paddingTop: topPadding + 16 }]}
            >
              <Animated.View entering={FadeIn.delay(100)}>
                <View style={styles.resultIconWrap}>
                  <Text style={styles.resultBigEmoji}>✅</Text>
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

            {((scanResult.xpEarned ?? 0) > 0 || (scanResult.leaEarned ?? 0) > 0) && (
              <Animated.View entering={FadeInDown.delay(220)} style={styles.earnedRow}>
                <View style={styles.earnedItem}>
                  <Feather name="star" size={20} color={Colors.leaf} />
                  <Text style={styles.earnedLabel}>XP guadagnati</Text>
                  <Text style={styles.earnedValue}>+{scanResult.xpEarned ?? 0} XP</Text>
                </View>
                <View style={styles.earnedDivider} />
                <View style={styles.earnedItem}>
                  <Feather name="dollar-sign" size={20} color="#FFD700" />
                  <Text style={styles.earnedLabel}>$LEA guadagnati</Text>
                  <Text style={[styles.earnedValue, { color: "#FFD700" }]}>+{(scanResult.leaEarned ?? 0).toFixed(2)} $LEA</Text>
                  {hasBattlePass && (
                    <View style={styles.x2Badge}>
                      <Text style={styles.x2BadgeText}>x2</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {totalIdonei > 0 && (
              <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                <Text style={styles.pendingTitle}>Prodotti idonei ({totalIdonei})</Text>
                {idoneiUnmatched.map((product, i) => (
                  <View key={`iu-${i}`} style={styles.pendingProductRow}>
                    <Text style={styles.productEmoji}>{getProductEmoji(product.name, product.category, product.emoji)}</Text>
                    <Text style={styles.pendingProductName} numberOfLines={1}>{product.name}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.scanProductMiniBtn, pressed && { opacity: 0.75 }]}
                      onPress={() => openBarcodeScanner(scanResult.receiptId, product.name)}
                    >
                      <Text style={styles.scanProductMiniBtnText}>Scansiona</Text>
                    </Pressable>
                  </View>
                ))}
                {idoneiMatched.map((product, i) => (
                  <View key={`im-${i}`} style={[styles.pendingProductRow, { opacity: 0.6 }]}>
                    <Text style={styles.productEmoji}>{getProductEmoji(product.name, product.category, product.emoji)}</Text>
                    <Text style={[styles.pendingProductName, { flex: 1 }]} numberOfLines={1}>{product.name}</Text>
                    <View style={styles.verifiedInlineBadge}>
                      <Feather name="check" size={12} color={Colors.leaf} />
                      <Text style={styles.verifiedInlineText}>+{product.points} pt</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}

            {nonIdonei.length > 0 && (
              <Animated.View entering={FadeInDown.delay(350)} style={[styles.section, styles.nonGreenSection]}>
                <Text style={styles.nonGreenTitle}>Prodotti non idonei ({nonIdonei.length})</Text>
                {nonIdonei.map((product, i) => (
                  <View key={`ni-${i}`} style={styles.nonGreenRow}>
                    <Text style={styles.productEmoji}>{getProductEmoji(product.name, product.category, product.emoji)}</Text>
                    <Text style={styles.nonGreenName} numberOfLines={1}>{product.name}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(400)} style={styles.radarTipCard}>
              <View style={styles.radarTipHeader}>
                <Feather name="radio" size={16} color={Colors.leaf} />
                <Text style={styles.radarTipTitle}>Consiglio del Radar</Text>
              </View>
              <Text style={styles.radarTipText}>
                {[
                  "Scansiona i barcode dei prodotti idonei per guadagnare ancora più $LEA.",
                  "Prodotti con Eco-Score A o B valgono il doppio in punti.",
                  "Con il Battle Pass ogni $LEA guadagnato viene raddoppiato automaticamente.",
                  "Più scansioni fai ogni mese, più sali di livello e sblocchi badge esclusivi.",
                  "I prodotti bio e a km0 ottengono un bonus punti aggiuntivo.",
                ][scanResult.receiptId % 5]}
              </Text>
            </Animated.View>

            <View style={styles.section}>
              <Pressable style={styles.scanProductsBtn} onPress={goToStorico}>
                <LinearGradient
                  colors={[Colors.leaf, Colors.forest]}
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
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <LinearGradient colors={[Colors.primaryLight, Colors.background]} style={StyleSheet.absoluteFill} />
        {imageUri && <Image source={{ uri: imageUri }} style={styles.scanningImage} />}
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.scanningText}>Verifica in corso...</Text>
          <Text style={styles.scanningSubText}>Controllo anti-frode sullo scontrino</Text>
        </View>
      </View>
    );
  }

  if (state === "preview" && imageUri) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.previewHeader}>
          <Pressable onPress={reset}>
            <Feather name="x" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.previewTitle}>Scontrino</Text>
          <View style={{ width: 24 }} />
        </View>
        <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        <Animated.View entering={SlideInDown.springify()} style={[styles.previewActions, { paddingBottom: bottomPad / 2 }]}>
          <Pressable style={styles.secondaryBtn} onPress={() => pickImage("camera")}>
            <Feather name="camera" size={18} color={Colors.leaf} />
            <Text style={styles.secondaryBtnText}>Cambia</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={startScan}>
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
        <ScrollView style={[styles.container, { paddingTop: topPadding }]} contentContainerStyle={{ paddingBottom: bottomPad }}>
          <View style={styles.idleHeader}>
            <Text style={styles.idleTitle}>In sospeso</Text>
            <Text style={styles.idleSub}>
              Scansiona i prodotti per guadagnare i tuoi punti
            </Text>
          </View>

          <View style={styles.activeSessionCard}>
            <View style={styles.activeSessionTop}>
              <View>
                <Text style={styles.activeStoreName}>{r.storeName ?? "Negozio"}</Text>
                <View style={styles.activeTimerRow}>
                  <Feather name="clock" size={14} color={Colors.textSecondary} />
                  <Text style={styles.activeTimerText}>
                    {formatTimeRemaining(activeSession.remainingMinutes)} rimasti
                  </Text>
                </View>
              </View>
              <View style={styles.activePointsBadge}>
                <Text style={{ fontSize: 14 }}>🌿</Text>
                <Text style={styles.activePointsText}>{r.pointsEarned} pt</Text>
              </View>
            </View>

            {pendingItems.length > 0 && (
              <View style={styles.scannedList}>
                <Text style={styles.scannedListTitle}>
                  Da verificare ({pendingItems.length})
                </Text>
                {pendingItems.map((p, i) => (
                  <View key={i} style={styles.pendingProductRow}>
                    <View style={styles.pendingProductIcon}>
                      <MaterialCommunityIcons name="barcode-scan" size={16} color={Colors.textSecondary} />
                    </View>
                    <Text style={styles.pendingProductName} numberOfLines={1}>{p.name}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.scanProductMiniBtn, pressed && { opacity: 0.75 }]}
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
                <Text style={styles.scannedListTitle}>
                  Verificati ({confirmedItems.length})
                </Text>
                {confirmedItems.map((s) => (
                  <View key={s.id} style={styles.scannedItem}>
                    <Text style={styles.scannedEmoji}>{s.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scannedName} numberOfLines={1}>{s.productName}</Text>
                      <Text style={styles.scannedCat}>{s.category}</Text>
                    </View>
                    <Text style={styles.scannedPts}>+{s.pointsEarned}</Text>
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
                  colors={[Colors.leaf, Colors.forest]}
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
            <Text style={styles.orText}>oppure</Text>
            <Pressable style={styles.newReceiptBtn} onPress={() => pickImage("camera")}>
              <Feather name="camera" size={18} color={Colors.leaf} />
              <Text style={styles.newReceiptBtnText}>Scansiona un nuovo scontrino</Text>
            </Pressable>
          </View>
        </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={[styles.idleContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.idleHeader}>
        <Text style={styles.idleTitle}>Scansiona</Text>
        <View style={styles.idleSubRow}>
          <Text style={{ fontSize: 14 }}>🌿</Text>
          <Text style={styles.idleSub}>Guadagna punti per ogni acquisto sostenibile</Text>
        </View>
      </View>

      {sessionLoading ? (
        <ActivityIndicator size="large" color={Colors.leaf} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.actionCardsSection}>
            <Pressable
              onPressIn={() => { cameraScale.value = withSpring(0.97, { damping: 15, stiffness: 250 }); }}
              onPressOut={() => { cameraScale.value = withSpring(1, { damping: 10, stiffness: 180 }); }}
              onPress={() => pickImage("camera")}
              accessibilityRole="button"
              accessibilityLabel="Fotografa lo scontrino"
            >
              <Animated.View style={cameraAnimStyle}>
                <LinearGradient
                  colors={["#3a8f65", Colors.leaf, "#245a42"]}
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
              style={({ pressed }) => [styles.actionCardWide, pressed && { opacity: 0.85 }]}
              onPress={() => {
                if (!user) { router.push("/(tabs)"); return; }
                router.push("/shopping-scanner");
              }}
            >
              <View style={[styles.actionCardSmallIcon, { backgroundColor: Colors.primaryLight }]}>
                <MaterialCommunityIcons name="cart-outline" size={22} color={Colors.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionCardSmallTitle}>Modalità Spesa</Text>
                <Text style={styles.actionCardSmallSub}>Scansiona i barcode dei prodotti</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </Pressable>

            <View style={styles.scanHint}>
              <Feather name="info" size={13} color={Colors.textSecondary} />
              <Text style={styles.scanHintText}>Assicurati che totale e data siano leggibili</Text>
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
  resultBigEmoji: { fontSize: 64, textAlign: "center" },
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
  welcomeOverlayEmoji: { fontSize: 64, marginBottom: 16 },
  welcomeOverlayTitle: { fontSize: 28, fontFamily: "DMSans_700Bold", color: Colors.forest, marginBottom: 12, textAlign: "center" },
  welcomeOverlayText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, textAlign: "center", lineHeight: 22 },
  productEmoji: { fontSize: 18, marginRight: 4, width: 24 },
  nonGreenSection: { backgroundColor: Colors.background, borderRadius: 12, paddingVertical: 12 },
  nonGreenTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8, paddingHorizontal: 4 },
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

  earnedRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  earnedItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 4,
  },
  earnedLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earnedValue: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    color: Colors.leaf,
  },
  earnedDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
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
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(46,107,80,0.15)",
  },
  radarTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radarTipTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
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
