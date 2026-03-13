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
import Animated, { FadeIn, FadeInDown, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { router } from "expo-router";

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

  const { data: activeSession, isLoading: sessionLoading } = useQuery<ActiveSession>({
    queryKey: ["active-session"],
    queryFn: () => apiFetch("/scan/active-session"),
    enabled: !!user,
    refetchInterval: 60000,
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
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.idleHeader}>
        <Text style={styles.idleTitle}>Scansiona</Text>
        <Text style={styles.idleSub}>
          Fotografa il tuo scontrino, poi scansiona i codici a barre dei prodotti per guadagnare punti
        </Text>
      </View>

      {sessionLoading ? (
        <ActivityIndicator size="large" color={Colors.leaf} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.idleOptions}>
            <Pressable
              style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
              onPress={() => pickImage("camera")}
            >
              <LinearGradient
                colors={[Colors.leaf, Colors.forest]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.optionGradient}
              >
                <Feather name="camera" size={48} color="#fff" />
                <Text style={styles.optionTitle}>Fotocamera</Text>
                <Text style={styles.optionSub}>Scatta una foto allo scontrino</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
              onPress={() => pickImage("gallery")}
            >
              <View style={styles.optionSecondary}>
                <Feather name="image" size={48} color={Colors.leaf} />
                <Text style={[styles.optionTitle, { color: Colors.text }]}>Galleria</Text>
                <Text style={[styles.optionSub, { color: Colors.textSecondary }]}>
                  Scegli dalla libreria foto
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.steps}>
            <Text style={styles.stepsTitle}>Come funziona</Text>
            {[
              { icon: "file-text" as const, text: "1. Fotografa lo scontrino come prova d'acquisto" },
              { icon: "maximize" as const, text: "2. Scansiona i codici a barre dei prodotti" },
              { icon: "award" as const, text: "3. Guadagna punti in base all'Eco-Score" },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  <Feather name={step.icon} size={16} color={Colors.leaf} />
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center",
  },
  idleHeader: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  idleTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 8 },
  idleSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 22 },
  idleOptions: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  optionCard: {
    flex: 1, borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  optionCardPressed: { opacity: 0.88 },
  optionGradient: { padding: 24, alignItems: "center", gap: 10, minHeight: 180, justifyContent: "center" },
  optionSecondary: {
    padding: 24, alignItems: "center", gap: 10, minHeight: 180, justifyContent: "center",
    backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.border, borderRadius: 20,
  },
  optionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  optionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", textAlign: "center" },
  steps: { paddingHorizontal: 24, gap: 12 },
  stepsTitle: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  stepText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  previewHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  previewTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  previewImage: { flex: 1, width: "100%" },
  previewActions: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.leaf, borderRadius: 16, paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: Colors.leaf,
  },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.leaf },
  scanningImage: { width: "90%", height: "60%", borderRadius: 16, opacity: 0.4 },
  scanningOverlay: { position: "absolute", alignItems: "center", gap: 12 },
  scanningText: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, marginTop: 12 },
  scanningSubText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  resultHeader: {
    paddingHorizontal: 24, paddingBottom: 32,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, alignItems: "center",
  },
  resultIconWrap: { alignItems: "center", marginBottom: 12 },
  resultTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center", marginBottom: 4 },
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
  scanProductsBtn: { borderRadius: 20, overflow: "hidden" },
  scanProductsBtnGrad: { padding: 24, alignItems: "center", gap: 8 },
  scanProductsBtnTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  scanProductsBtnSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  laterBtn: { alignItems: "center", paddingVertical: 16 },
  laterBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  activeSessionCard: { marginHorizontal: 20, backgroundColor: Colors.card, borderRadius: 20, padding: 16, gap: 16 },
  activeSessionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeStoreName: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
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
    backgroundColor: Colors.card, borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: Colors.leaf,
  },
  newReceiptBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.leaf },
});
