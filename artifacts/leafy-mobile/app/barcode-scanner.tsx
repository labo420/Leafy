import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";

interface LookupResult {
  barcode: string;
  productName: string;
  ecoScore: string | null;
  pointsToAward: number;
  category: string;
  emoji: string;
  reasoning: string;
  source: string;
  remainingDailyPoints: number;
}

interface ConfirmResult {
  scanId: number;
  productName: string;
  ecoScore: string | null;
  pointsEarned: number;
  category: string;
  emoji: string;
  reasoning: string;
  source: string;
  totalPoints: number;
  remainingDailyPoints: number;
}

interface ScannedProduct {
  barcode: string;
  productName: string;
  ecoScore: string | null;
  pointsEarned: number;
  emoji: string;
  category: string;
}

const ECO_COLORS: Record<string, string> = {
  a: "#1E8C45",
  b: "#60AC0E",
  c: "#FECB02",
  d: "#EE8100",
  e: "#E63E11",
};

type ScanPhase = "scanning" | "looking-up" | "preview" | "confirming" | "confirmed";

function EcoScoreBadge({ score }: { score: string | null }) {
  if (!score) return null;
  const letter = score.toLowerCase();
  const bg = ECO_COLORS[letter] ?? Colors.textSecondary;
  return (
    <View style={[styles.ecoBadge, { backgroundColor: bg }]}>
      <Text style={styles.ecoBadgeText}>{letter.toUpperCase()}</Text>
    </View>
  );
}

export default function BarcodeScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { receiptId: receiptIdStr } = useLocalSearchParams<{ receiptId: string }>();
  const receiptId = parseInt(receiptIdStr ?? "0", 10);

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [phase, setPhase] = useState<ScanPhase>("scanning");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [lastConfirmed, setLastConfirmed] = useState<ConfirmResult | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const topPadding = Platform.OS === "web" ? 20 : insets.top;

  if (!receiptId || receiptId === 0) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Feather name="alert-circle" size={56} color={Colors.amber} />
        <Text style={styles.permTitle}>Nessuna sessione attiva</Text>
        <Text style={styles.permSub}>
          Per scansionare i prodotti devi prima scansionare uno scontrino come prova d'acquisto.
          Vai alla schermata Scansiona per fotografare il tuo scontrino.
        </Text>
        <Pressable style={styles.permBtn} onPress={() => router.back()}>
          <Text style={styles.permBtnText}>Scansiona scontrino</Text>
        </Pressable>
      </View>
    );
  }

  const lookupMutation = useMutation({
    mutationFn: (barcode: string) =>
      apiFetch<LookupResult>("/scan/barcode/lookup", {
        method: "POST",
        body: JSON.stringify({ barcode, receiptId }),
      }),
    onSuccess: (data) => {
      setLookupData(data);
      setPhase("preview");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (err: Error) => {
      setPhase("scanning");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
      Alert.alert("Attenzione", err.message ?? "Errore nella ricerca del prodotto");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (barcode: string) =>
      apiFetch<ConfirmResult>("/scan/barcode/confirm", {
        method: "POST",
        body: JSON.stringify({ barcode, receiptId }),
      }),
    onSuccess: (data) => {
      setLastConfirmed(data);
      setScannedProducts((prev) => [
        {
          barcode: lookupData?.barcode ?? "",
          productName: data.productName,
          ecoScore: data.ecoScore,
          pointsEarned: data.pointsEarned,
          emoji: data.emoji,
          category: data.category,
        },
        ...prev,
      ]);
      setPhase("confirmed");
      setLookupData(null);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["active-session"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      setPhase("preview");
      Alert.alert("Errore", err.message ?? "Impossibile confermare il prodotto");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (phase !== "scanning" || cooldown) return;
      setPhase("looking-up");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lookupMutation.mutate(data);
    },
    [phase, cooldown],
  );

  const handleConfirm = () => {
    if (!lookupData) return;
    setPhase("confirming");
    confirmMutation.mutate(lookupData.barcode);
  };

  const handleReject = () => {
    setLookupData(null);
    setPhase("scanning");
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1500);
  };

  const continueScan = () => {
    setLastConfirmed(null);
    setPhase("scanning");
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1500);
  };

  const handleManualSearch = () => {
    const code = manualCode.trim();
    if (code.length < 8) return;
    setShowManualInput(false);
    setManualCode("");
    setPhase("looking-up");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lookupMutation.mutate(code);
  };

  const finish = () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["receipts"] });
    router.back();
  };

  const totalPointsEarned = scannedProducts.reduce((s, p) => s + p.pointsEarned, 0);

  if (!permission) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Feather name="camera-off" size={56} color={Colors.textSecondary} />
        <Text style={styles.permTitle}>Fotocamera richiesta</Text>
        <Text style={styles.permSub}>Per scansionare i codici a barre serve accesso alla fotocamera</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Abilita fotocamera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={[styles.permSub, { color: Colors.leaf }]}>Torna indietro</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "preview" && lookupData) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={[Colors.forest, Colors.leaf]} style={styles.previewBanner}>
          <Animated.View entering={FadeIn.delay(100)} style={styles.previewContent}>
            <Text style={styles.previewEmoji}>{lookupData.emoji}</Text>
            <Text style={styles.previewName}>{lookupData.productName}</Text>
            <View style={styles.previewRow}>
              <EcoScoreBadge score={lookupData.ecoScore} />
              <Text style={styles.previewCategory}>{lookupData.category}</Text>
            </View>
            <Text style={styles.previewReasoning}>{lookupData.reasoning}</Text>
            <View style={styles.previewPointsBox}>
              <Text style={styles.previewPointsLabel}>Punti da guadagnare</Text>
              <Text style={styles.previewPointsValue}>+{lookupData.pointsToAward}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.previewActions}>
          <Pressable style={styles.rejectBtn} onPress={handleReject}>
            <Feather name="x" size={18} color={Colors.red} />
            <Text style={styles.rejectBtnText}>Annulla</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Conferma</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.previewHintBox}>
          <Feather name="info" size={14} color={Colors.textSecondary} />
          <Text style={styles.previewHintText}>
            Conferma se hai acquistato questo prodotto per ricevere i punti
          </Text>
        </Animated.View>
      </View>
    );
  }

  if (phase === "confirming") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.leaf} />
        <Text style={styles.processingFullText}>Conferma in corso...</Text>
      </View>
    );
  }

  if (phase === "confirmed" && lastConfirmed) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <LinearGradient colors={[Colors.forest, Colors.leaf]} style={styles.resultBanner}>
          <Animated.View entering={FadeIn.delay(100)} style={styles.resultContent}>
            <Feather name="check-circle" size={40} color="#fff" />
            <Text style={styles.resultEmoji}>{lastConfirmed.emoji}</Text>
            <Text style={styles.resultName}>{lastConfirmed.productName}</Text>
            <View style={styles.resultRow}>
              <EcoScoreBadge score={lastConfirmed.ecoScore} />
              <Text style={styles.resultCategory}>{lastConfirmed.category}</Text>
            </View>
            <View style={styles.resultPointsBox}>
              <Text style={styles.resultPointsLabel}>Punti guadagnati</Text>
              <Text style={styles.resultPointsValue}>+{lastConfirmed.pointsEarned}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.resultActions}>
          <Pressable style={styles.primaryBtn} onPress={continueScan}>
            <Feather name="camera" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Scansiona altro</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={finish}>
            <Feather name="check" size={18} color={Colors.leaf} />
            <Text style={styles.secondaryBtnText}>Finito ({totalPointsEarned} pt)</Text>
          </Pressable>
        </Animated.View>

        {scannedProducts.length > 1 && (
          <Animated.View entering={FadeInDown.delay(300)}>
            <Text style={styles.listTitle}>Prodotti scansionati ({scannedProducts.length})</Text>
            <FlatList
              data={scannedProducts}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemEmoji}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listItemName} numberOfLines={1}>{item.productName}</Text>
                      <Text style={styles.listItemCat}>{item.category}</Text>
                    </View>
                  </View>
                  <View style={styles.listItemRight}>
                    <EcoScoreBadge score={item.ecoScore} />
                    <Text style={styles.listItemPts}>+{item.pointsEarned}</Text>
                  </View>
                </View>
              )}
              style={{ maxHeight: 200 }}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            />
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] }}
        onBarcodeScanned={phase === "scanning" && !cooldown ? handleBarCodeScanned : undefined}
      />

      <View style={[styles.cameraOverlay, { paddingTop: topPadding + 16 }]}>
        <View style={styles.cameraHeader}>
          <Pressable onPress={finish} style={styles.closeBtn}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.cameraTitle}>Scansiona prodotto</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.reticle}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {phase === "looking-up" && (
          <Animated.View entering={SlideInUp} style={styles.processingBar}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.processingText}>Ricerca prodotto...</Text>
          </Animated.View>
        )}

        <View style={[styles.cameraFooter, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.cameraHint}>Inquadra il codice a barre del prodotto</Text>
          {scannedProducts.length > 0 && (
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="leaf" size={16} color={Colors.leaf} />
              <Text style={styles.summaryText}>
                {scannedProducts.length} prodotti | +{totalPointsEarned} punti
              </Text>
            </View>
          )}
          <Pressable onPress={() => { setManualCode(""); setShowManualInput(true); }}>
            <Text style={styles.manualLink}>Non riesci a scansionare? Inserisci il codice</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showManualInput}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <KeyboardAvoidingView
          style={styles.manualOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowManualInput(false)} />
          <View style={styles.manualPanel}>
            <Text style={styles.manualTitle}>Inserisci codice a barre</Text>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="number-pad"
              placeholder="Es. 8712345678900"
              placeholderTextColor={Colors.textSecondary}
              maxLength={14}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleManualSearch}
            />
            <View style={styles.manualBtns}>
              <Pressable style={styles.manualCancelBtn} onPress={() => setShowManualInput(false)}>
                <Text style={styles.manualCancelText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.manualSearchBtn, manualCode.trim().length < 8 && styles.manualSearchBtnDisabled]}
                onPress={handleManualSearch}
                disabled={manualCode.trim().length < 8}
              >
                <Feather name="search" size={16} color="#fff" />
                <Text style={styles.manualSearchText}>Cerca</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  permTitle: { fontSize: 22, fontFamily: "DMSans_700Bold", color: Colors.text, marginTop: 16, textAlign: "center" },
  permSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 22 },
  permBtn: { marginTop: 24, backgroundColor: Colors.leaf, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  permBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  cameraHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  cameraTitle: { fontSize: 18, fontFamily: "DMSans_700Bold", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  reticle: { width: 260, height: 160, alignSelf: "center", position: "relative" },
  corner: { position: "absolute", width: 30, height: 30, borderColor: Colors.leaf, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  processingBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12,
  },
  processingText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  processingFullText: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 16 },
  cameraFooter: { alignItems: "center", gap: 8, paddingTop: 16 },
  cameraHint: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  summaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  previewBanner: { paddingHorizontal: 24, paddingVertical: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  previewContent: { alignItems: "center", gap: 8 },
  previewEmoji: { fontSize: 48 },
  previewName: { fontSize: 22, fontFamily: "DMSans_700Bold", color: "#fff", textAlign: "center" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewCategory: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  previewReasoning: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", textAlign: "center" },
  previewPointsBox: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 24, padding: 16, alignItems: "center", marginTop: 8, width: "100%" },
  previewPointsLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },
  previewPointsValue: { fontSize: 40, fontFamily: "DMSans_700Bold", color: "#fff" },
  previewActions: { flexDirection: "row", gap: 12, padding: 20 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.card, borderRadius: 24, paddingVertical: 16, borderWidth: 1.5, borderColor: Colors.red },
  rejectBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.red },
  confirmBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.leaf, borderRadius: 24, paddingVertical: 16 },
  confirmBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  previewHintBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, backgroundColor: Colors.cardAlt, borderRadius: 12, padding: 14 },
  previewHintText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  resultBanner: { paddingHorizontal: 24, paddingVertical: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  resultContent: { alignItems: "center", gap: 8 },
  resultEmoji: { fontSize: 40 },
  resultName: { fontSize: 20, fontFamily: "DMSans_700Bold", color: "#fff", textAlign: "center" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultCategory: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  resultPointsBox: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 24, padding: 16, alignItems: "center", marginTop: 8, width: "100%" },
  resultPointsLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },
  resultPointsValue: { fontSize: 40, fontFamily: "DMSans_700Bold", color: "#fff" },
  resultActions: { flexDirection: "row", gap: 12, padding: 20 },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.leaf, borderRadius: 24, paddingVertical: 16 },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  secondaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.card, borderRadius: 24, paddingVertical: 16, borderWidth: 1.5, borderColor: Colors.leaf },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.leaf },
  ecoBadge: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  ecoBadgeText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  listTitle: { fontSize: 16, fontFamily: "DMSans_700Bold", color: Colors.text, paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  listItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  listItemLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  listItemEmoji: { fontSize: 24 },
  listItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  listItemCat: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  listItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  listItemPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf },
  manualLink: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)",
    textDecorationLine: "underline", textAlign: "center",
  },
  manualOverlay: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)",
  },
  manualPanel: {
    backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 16,
  },
  manualTitle: { fontSize: 18, fontFamily: "DMSans_700Bold", color: Colors.text, textAlign: "center" },
  manualInput: {
    backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.border, letterSpacing: 2,
  },
  manualBtns: { flexDirection: "row", gap: 12 },
  manualCancelBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  manualCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  manualSearchBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.leaf, borderRadius: 14, paddingVertical: 14,
  },
  manualSearchBtnDisabled: { opacity: 0.45 },
  manualSearchText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
