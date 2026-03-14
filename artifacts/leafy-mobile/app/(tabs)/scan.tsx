import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  withRepeat, withTiming, withDelay, Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { router } from "expo-router";
import type { Profile } from "@workspace/api-client-react";

interface AcceptedStoresData {
  standard: string[];
  bio: string[];
  discount: string[];
}

interface ScanResponse {
  receiptId: number;
  barcodeExpiry: string;
  storeName: string | null;
  message: string;
  sessionHours: number;
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

function getMotivationMessage(profile: Profile | undefined): { emoji: string; line1: string; line2: string } {
  if (!profile) return { emoji: "🌿", line1: "Benvenuto!", line2: "Scansiona il tuo primo scontrino" };
  const { totalPoints, streak } = profile;
  if (streak >= 7) return { emoji: "🔥", line1: `${streak} giorni di streak!`, line2: `${totalPoints} punti accumulati — fantastico` };
  if (streak >= 3) return { emoji: "⚡", line1: `Streak di ${streak} giorni`, line2: `Hai guadagnato ${totalPoints} punti — continua!` };
  if (totalPoints > 500) return { emoji: "🌟", line1: `${totalPoints} punti totali`, line2: "Sei un eco-campione — vai avanti!" };
  if (totalPoints > 0) return { emoji: "🌱", line1: `${totalPoints} punti guadagnati`, line2: "Ogni acquisto conta per il pianeta" };
  return { emoji: "👋", line1: "Prima scansione?", line2: "Guadagna subito i tuoi primi punti" };
}

function MotivationCard({ profile }: { profile: Profile | undefined }) {
  const msg = getMotivationMessage(profile);
  return (
    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.motivCard}>
      <LinearGradient
        colors={["#f0f9f4", "#e8f5ed"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.motivGradient}
      >
        <Text style={styles.motivEmoji}>{msg.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.motivLine1}>{msg.line1}</Text>
          <Text style={styles.motivLine2}>{msg.line2}</Text>
        </View>
        {profile && profile.streak > 0 && (
          <View style={styles.motivStreak}>
            <MaterialCommunityIcons name="fire" size={14} color={Colors.leaf} />
            <Text style={styles.motivStreakText}>{profile.streak}</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
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
      <Pressable style={styles.storesToggle} onPress={() => setOpen(!open)}>
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
      <Pressable style={styles.howToggle} onPress={() => setOpen(!open)}>
        <View style={styles.howToggleLeft}>
          <Feather name="help-circle" size={16} color={Colors.textSecondary} />
          <Text style={styles.howToggleText}>Come funziona</Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.howSteps}>
          {[
            { icon: "file-text" as const, text: "Fotografa lo scontrino (totale e data visibili)" },
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanState>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;
  const cameraScale = useSharedValue(1);
  const cameraAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

  const pulse1Scale = useSharedValue(1);
  const pulse1Opacity = useSharedValue(0.5);
  const pulse2Scale = useSharedValue(1);
  const pulse2Opacity = useSharedValue(0.5);

  useEffect(() => {
    const dur = 2200;
    const expand = { duration: dur, easing: Easing.out(Easing.ease) };
    pulse1Scale.value = withRepeat(withTiming(1.35, expand), -1, false);
    pulse1Opacity.value = withRepeat(withTiming(0, expand), -1, false);
    pulse2Scale.value = withDelay(700,
      withRepeat(withTiming(1.35, expand), -1, false));
    pulse2Opacity.value = withDelay(700,
      withRepeat(withTiming(0, expand), -1, false));
  }, []);

  const pulse1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1Scale.value }],
    opacity: pulse1Opacity.value,
  }));
  const pulse2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2Scale.value }],
    opacity: pulse2Opacity.value,
  }));

  const { data: activeSession, isLoading: sessionLoading } = useQuery<ActiveSession>({
    queryKey: ["active-session"],
    queryFn: () => apiFetch("/scan/active-session"),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const { data: profile } = useQuery<Profile>({
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
    onSuccess: (data) => {
      setScanResult(data);
      setState("confirmed");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["active-session"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      Alert.alert("Errore", err.message ?? "Impossibile validare lo scontrino");
      setState("preview");
    },
  });

  const pickImage = async (source: "camera" | "gallery") => {
    if (!user) {
      router.push("/login");
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

  const openBarcodeScanner = (receiptId: number) => {
    router.push({ pathname: "/barcode-scanner", params: { receiptId: String(receiptId) } });
  };

  if (state === "confirmed" && scanResult) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <LinearGradient
          colors={[Colors.forest, Colors.leaf]}
          style={[styles.resultHeader, { paddingTop: topPadding + 16 }]}
        >
          <Animated.View entering={FadeIn.delay(100)}>
            <View style={styles.resultIconWrap}>
              <Feather name="check-circle" size={56} color="#fff" />
            </View>
            <Text style={styles.resultTitle}>Scontrino confermato!</Text>
            <Text style={styles.resultSub}>{scanResult.message}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.timerBox}>
            <Feather name="clock" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.timerText}>
              Hai {scanResult.sessionHours} ore per scansionare i prodotti
            </Text>
          </Animated.View>
        </LinearGradient>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Pressable
            style={styles.scanProductsBtn}
            onPress={() => openBarcodeScanner(scanResult.receiptId)}
          >
            <LinearGradient
              colors={[Colors.leaf, Colors.forest]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scanProductsBtnGrad}
            >
              <MaterialCommunityIcons name="barcode-scan" size={32} color="#fff" />
              <Text style={styles.scanProductsBtnTitle}>Scansiona Prodotti</Text>
              <Text style={styles.scanProductsBtnSub}>
                Inquadra i codici a barre per guadagnare punti
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={styles.section}>
          <Pressable style={styles.laterBtn} onPress={reset}>
            <Text style={styles.laterBtnText}>Lo faccio dopo</Text>
          </Pressable>
        </View>
      </ScrollView>
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
          <Pressable style={styles.secondaryBtn} onPress={() => pickImage("gallery")}>
            <Feather name="refresh-ccw" size={18} color={Colors.leaf} />
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
    return (
      <ScrollView style={[styles.container, { paddingTop: topPadding }]} contentContainerStyle={{ paddingBottom: bottomPad }}>
        <View style={styles.idleHeader}>
          <Text style={styles.idleTitle}>Sessione attiva</Text>
          <Text style={styles.idleSub}>
            Hai uno scontrino aperto — scansiona i prodotti per guadagnare punti
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
              <MaterialCommunityIcons name="leaf" size={16} color={Colors.leaf} />
              <Text style={styles.activePointsText}>{r.pointsEarned} pt</Text>
            </View>
          </View>

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
              <Text style={styles.scanProductsBtnSub}>
                {r.greenItemsCount > 0
                  ? `${r.greenItemsCount} prodotti scansionati`
                  : "Inquadra i codici a barre"}
              </Text>
            </LinearGradient>
          </Pressable>

          {activeSession.barcodeScans.length > 0 && (
            <View style={styles.scannedList}>
              <Text style={styles.scannedListTitle}>Prodotti scansionati</Text>
              {activeSession.barcodeScans.map((s) => (
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
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPad }]}>
      <View style={styles.idleHeader}>
        <Text style={styles.idleTitle}>Scansiona</Text>
        <Text style={styles.idleSub}>Guadagna punti per ogni acquisto sostenibile</Text>
      </View>

      {sessionLoading ? (
        <ActivityIndicator size="large" color={Colors.leaf} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.bigBtnCenter}>
            <Pressable
              onPressIn={() => { cameraScale.value = withSpring(0.92, { damping: 15, stiffness: 250 }); }}
              onPressOut={() => { cameraScale.value = withSpring(1, { damping: 10, stiffness: 180 }); }}
              onPress={() => pickImage("camera")}
              accessibilityRole="button"
              accessibilityLabel="Fotografa lo scontrino"
              accessibilityHint="Apre la fotocamera per scansionare uno scontrino"
            >
              <View style={styles.bigBtnPulseContainer}>
                <Animated.View style={[styles.bigBtnPulseRing, pulse1Style]} />
                <Animated.View style={[styles.bigBtnPulseRing, pulse2Style]} />
                <Animated.View style={[styles.bigBtnOuter, cameraAnimStyle]}>
                  <LinearGradient
                    colors={["#3a8f65", Colors.leaf, "#245a42"]}
                    locations={[0, 0.45, 1]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.bigBtnGrad}
                  >
                    <Feather name="camera" size={72} color="#fff" />
                    <Text style={styles.bigBtnLabel}>Fotografa lo scontrino</Text>
                    <Text style={styles.bigBtnHint}>Totale e data visibili</Text>
                  </LinearGradient>
                </Animated.View>
              </View>
            </Pressable>
          </View>

          <View style={styles.bottomActions}>
            <Pressable
              style={({ pressed }) => [styles.galleryLink, pressed && { opacity: 0.6 }]}
              onPress={() => pickImage("gallery")}
            >
              <Feather name="image" size={16} color={Colors.textSecondary} />
              <Text style={styles.galleryLinkText}>Scegli dalla galleria</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.shoppingLink, pressed && { opacity: 0.6 }]}
              onPress={() => {
                if (!user) { router.push("/login"); return; }
                router.push("/shopping-scanner");
              }}
            >
              <MaterialCommunityIcons name="cart-outline" size={16} color={Colors.leaf} />
              <Text style={styles.shoppingLinkText}>Modalità Spesa</Text>
              <Feather name="chevron-right" size={14} color={Colors.leaf} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  idleContent: { flexGrow: 1 },
  centered: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center",
  },

  idleHeader: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  idleTitle: { fontSize: 32, fontFamily: "DMSans_700Bold", color: Colors.text, marginBottom: 4 },
  idleSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  motivCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, overflow: "hidden" },
  motivGradient: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  motivEmoji: { fontSize: 28 },
  motivLine1: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf },
  motivLine2: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  motivStreak: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  motivStreakText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.leaf },

  bigBtnCenter: {
    flex: 1, alignItems: "center", justifyContent: "center",
  },
  bigBtnPulseContainer: {
    width: 280, height: 280,
    alignItems: "center", justifyContent: "center",
  },
  bigBtnPulseRing: {
    position: "absolute",
    width: 260, height: 260, borderRadius: 130,
    borderWidth: 2,
    borderColor: "rgba(46,107,80,0.35)",
  },
  bigBtnOuter: {
    width: 260, height: 260, borderRadius: 130,
    overflow: "hidden",
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  bigBtnGrad: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 10,
  },
  bigBtnLabel: {
    fontSize: 20, fontFamily: "DMSans_700Bold", color: "#fff",
    textAlign: "center", marginTop: 4,
  },
  bigBtnHint: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)", textAlign: "center",
  },

  bottomActions: {
    paddingHorizontal: 24, paddingBottom: 8, gap: 12,
  },
  galleryLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8,
  },
  galleryLinkText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  shoppingLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8,
  },
  shoppingLinkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.leaf },

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
  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  timerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  scanProductsBtn: { borderRadius: 24, overflow: "hidden" },
  scanProductsBtnGrad: { padding: 24, alignItems: "center", gap: 8 },
  scanProductsBtnTitle: { fontSize: 20, fontFamily: "DMSans_700Bold", color: "#fff" },
  scanProductsBtnSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  laterBtn: { alignItems: "center", paddingVertical: 16 },
  laterBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
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
});
