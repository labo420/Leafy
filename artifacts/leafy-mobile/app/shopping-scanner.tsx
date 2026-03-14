import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import Colors from "@/constants/colors";

interface PreviewResult {
  barcode: string;
  productName: string;
  ecoScore: string | null;
  pointsEstimate: number;
  category: string;
  emoji: string;
  reasoning: string;
  source: string;
}

interface ScannedProduct {
  barcode: string;
  productName: string;
  ecoScore: string | null;
  pointsEstimate: number;
  emoji: string;
  category: string;
  reasoning: string;
}

const ECO_COLORS: Record<string, string> = {
  a: "#1E8C45",
  b: "#60AC0E",
  c: "#FECB02",
  d: "#EE8100",
  e: "#E63E11",
};

type ShoppingPhase = "scanning" | "looking-up" | "preview" | "report";

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

function ecoScoreLabel(score: string | null): string {
  if (!score) return "Non classificato";
  const map: Record<string, string> = {
    a: "Eccellente",
    b: "Buono",
    c: "Medio",
    d: "Scarso",
    e: "Molto scarso",
  };
  return map[score.toLowerCase()] ?? "Non classificato";
}

export default function ShoppingScannerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [phase, setPhase] = useState<ShoppingPhase>("scanning");
  const [lookupData, setLookupData] = useState<PreviewResult | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const topPadding = Platform.OS === "web" ? 20 : insets.top;

  const lookupMutation = useMutation({
    mutationFn: (barcode: string) =>
      apiFetch<PreviewResult>("/scan/barcode/preview", {
        method: "POST",
        body: JSON.stringify({ barcode }),
      }),
    onSuccess: (data) => {
      const alreadyScanned = scannedProducts.some((p) => p.barcode === data.barcode);
      if (alreadyScanned) {
        setPhase("scanning");
        setCooldown(true);
        setTimeout(() => setCooldown(false), 2000);
        Alert.alert("Già scansionato", "Questo prodotto è già nella tua lista.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      setLookupData(data);
      setPhase("preview");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (err: Error) => {
      setPhase("scanning");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
      Alert.alert("Attenzione", err.message ?? "Prodotto non trovato");
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

  const handleAddProduct = () => {
    if (!lookupData) return;
    setScannedProducts((prev) => [
      {
        barcode: lookupData.barcode,
        productName: lookupData.productName,
        ecoScore: lookupData.ecoScore,
        pointsEstimate: lookupData.pointsEstimate,
        emoji: lookupData.emoji,
        category: lookupData.category,
        reasoning: lookupData.reasoning,
      },
      ...prev,
    ]);
    setLookupData(null);
    setPhase("scanning");
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1500);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSkip = () => {
    setLookupData(null);
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
    router.back();
  };

  const totalEstimated = scannedProducts.reduce((s, p) => s + p.pointsEstimate, 0);

  const ecoBreakdown = scannedProducts.reduce<Record<string, { count: number; points: number }>>(
    (acc, p) => {
      const key = p.ecoScore?.toLowerCase() ?? "n/a";
      if (!acc[key]) acc[key] = { count: 0, points: 0 };
      acc[key].count++;
      acc[key].points += p.pointsEstimate;
      return acc;
    },
    {},
  );

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Feather name="log-in" size={56} color={Colors.textSecondary} />
        <Text style={styles.permTitle}>Accesso richiesto</Text>
        <Text style={styles.permSub}>Effettua il login per usare la Modalità Spesa</Text>
        <Pressable style={styles.permBtn} onPress={() => router.replace("/login")}>
          <Text style={styles.permBtnText}>Vai al login</Text>
        </Pressable>
      </View>
    );
  }

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

  if (phase === "report") {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <LinearGradient
            colors={[Colors.forest, Colors.leaf]}
            style={styles.reportHeader}
          >
            <Animated.View entering={FadeIn.delay(100)} style={styles.reportHeaderContent}>
              <MaterialCommunityIcons name="cart-check" size={48} color="#fff" />
              <Text style={styles.reportTitle}>Report Spesa</Text>
              <Text style={styles.reportSubtitle}>
                {scannedProducts.length} prodott{scannedProducts.length === 1 ? "o" : "i"} scansionat{scannedProducts.length === 1 ? "o" : "i"}
              </Text>
              <View style={styles.reportTotalBox}>
                <Text style={styles.reportTotalLabel}>Punti stimati</Text>
                <Text style={styles.reportTotalValue}>~{totalEstimated}</Text>
              </View>
              <View style={styles.reportDisclaimer}>
                <Feather name="info" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.reportDisclaimerText}>
                  Stima basata sull'Eco-Score — i punti reali verranno assegnati dopo la scansione dello scontrino
                </Text>
              </View>
            </Animated.View>
          </LinearGradient>

          {Object.keys(ecoBreakdown).length > 0 && (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>Breakdown Eco-Score</Text>
              <View style={styles.breakdownGrid}>
                {["a", "b", "c", "d", "e", "n/a"].map((key) => {
                  const data = ecoBreakdown[key];
                  if (!data) return null;
                  return (
                    <View key={key} style={styles.breakdownItem}>
                      {key !== "n/a" ? (
                        <EcoScoreBadge score={key} />
                      ) : (
                        <View style={[styles.ecoBadge, { backgroundColor: Colors.textMuted }]}>
                          <Text style={styles.ecoBadgeText}>?</Text>
                        </View>
                      )}
                      <Text style={styles.breakdownLabel}>
                        {key !== "n/a" ? ecoScoreLabel(key) : "N/D"}
                      </Text>
                      <Text style={styles.breakdownCount}>{data.count}x</Text>
                      <Text style={styles.breakdownPts}>~{data.points} pt</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Prodotti</Text>
            {scannedProducts.map((item, i) => (
              <View key={item.barcode + i} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemName} numberOfLines={1}>{item.productName}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <EcoScoreBadge score={item.ecoScore} />
                      <Text style={styles.listItemCat}>{item.category}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.listItemPts}>~{item.pointsEstimate}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
            <Pressable
              style={styles.ctaBtn}
              onPress={() => {
                router.back();
              }}
            >
              <LinearGradient
                colors={[Colors.leaf, Colors.forest]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <MaterialCommunityIcons name="receipt" size={24} color="#fff" />
                <Text style={styles.ctaBtnTitle}>Hai lo scontrino?</Text>
                <Text style={styles.ctaBtnSub}>Scansionalo per guadagnare i punti veri</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.closeReportBtn} onPress={finish}>
              <Text style={styles.closeReportText}>Chiudi</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
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
              <Text style={styles.previewPointsLabel}>Punti stimati</Text>
              <Text style={styles.previewPointsValue}>~{lookupData.pointsEstimate}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.previewActions}>
          <Pressable style={styles.skipBtn} onPress={handleSkip}>
            <Feather name="x" size={18} color={Colors.textSecondary} />
            <Text style={styles.skipBtnText}>Salta</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={handleAddProduct}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Aggiungi</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.previewHintBox}>
          <Feather name="info" size={14} color={Colors.textSecondary} />
          <Text style={styles.previewHintText}>
            Questa è una stima — i punti reali verranno assegnati dopo la scansione dello scontrino
          </Text>
        </View>
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
          <View style={styles.cameraTitleWrap}>
            <MaterialCommunityIcons name="cart-outline" size={20} color="#fff" />
            <Text style={styles.cameraTitle}>Modalità Spesa</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {scannedProducts.length > 0 && (
          <View style={styles.floatingCounter}>
            <MaterialCommunityIcons name="leaf" size={16} color={Colors.leaf} />
            <Text style={styles.floatingCounterText}>
              ~{totalEstimated} punti stimati
            </Text>
            <View style={styles.floatingCounterBadge}>
              <Text style={styles.floatingCounterBadgeText}>{scannedProducts.length}</Text>
            </View>
          </View>
        )}

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
          {scannedProducts.length > 0 && (
            <View style={styles.miniList}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.miniListScroll}
              >
                {scannedProducts.slice(0, 5).map((item, i) => (
                  <Animated.View key={item.barcode + i} entering={FadeIn} style={styles.miniListItem}>
                    <Text style={styles.miniListEmoji}>{item.emoji}</Text>
                    <Text style={styles.miniListName} numberOfLines={1}>{item.productName}</Text>
                    <Text style={styles.miniListPts}>~{item.pointsEstimate}</Text>
                  </Animated.View>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.cameraHint}>Inquadra il codice a barre del prodotto</Text>

          {scannedProducts.length > 0 && (
            <Pressable
              style={styles.viewReportBtn}
              onPress={() => setPhase("report")}
            >
              <Feather name="bar-chart-2" size={16} color="#fff" />
              <Text style={styles.viewReportText}>Vedi report ({scannedProducts.length})</Text>
            </Pressable>
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
  permTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, marginTop: 16, textAlign: "center" },
  permSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 22 },
  permBtn: { marginTop: 24, backgroundColor: Colors.leaf, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  permBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  cameraHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  cameraTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  cameraTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },

  floatingCounter: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 8,
  },
  floatingCounterText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  floatingCounterBadge: {
    backgroundColor: Colors.leaf, borderRadius: 10, width: 20, height: 20,
    alignItems: "center", justifyContent: "center", marginLeft: 2,
  },
  floatingCounterBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },

  reticle: { width: 260, height: 160, alignSelf: "center", position: "relative" },
  corner: { position: "absolute", width: 30, height: 30, borderColor: Colors.leaf, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },

  processingBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  processingText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  cameraFooter: { alignItems: "center", gap: 8, paddingTop: 16 },
  cameraHint: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },

  viewReportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.leaf, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  viewReportText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  manualLink: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)",
    textDecorationLine: "underline", textAlign: "center",
  },

  previewBanner: { paddingHorizontal: 24, paddingVertical: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  previewContent: { alignItems: "center", gap: 8 },
  previewEmoji: { fontSize: 48 },
  previewName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewCategory: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  previewReasoning: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", textAlign: "center" },
  previewPointsBox: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, padding: 16,
    alignItems: "center", marginTop: 8, width: "100%",
  },
  previewPointsLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },
  previewPointsValue: { fontSize: 40, fontFamily: "Inter_700Bold", color: "#fff" },

  previewActions: { flexDirection: "row", gap: 12, padding: 20 },
  skipBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.card, borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  skipBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.leaf, borderRadius: 16, paddingVertical: 16,
  },
  addBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  previewHintBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 20, backgroundColor: Colors.cardAlt, borderRadius: 12, padding: 14,
  },
  previewHintText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },

  reportHeader: {
    paddingHorizontal: 24, paddingVertical: 32, paddingTop: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  reportHeaderContent: { alignItems: "center", gap: 8 },
  reportTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  reportSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  reportTotalBox: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, padding: 16,
    alignItems: "center", marginTop: 8, width: "100%",
  },
  reportTotalLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },
  reportTotalValue: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#fff" },
  reportDisclaimer: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, padding: 10, marginTop: 4,
  },
  reportDisclaimerText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", flex: 1 },

  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12 },

  breakdownGrid: { gap: 8 },
  breakdownItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderRadius: 12, padding: 12,
  },
  breakdownLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  breakdownCount: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  breakdownPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf, minWidth: 60, textAlign: "right" },

  listItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  listItemLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  listItemEmoji: { fontSize: 24 },
  listItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  listItemCat: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  listItemPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf },

  ctaBtn: { borderRadius: 20, overflow: "hidden" },
  ctaGradient: { padding: 20, alignItems: "center", gap: 6 },
  ctaBtnTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  ctaBtnSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },

  closeReportBtn: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
  closeReportText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },

  miniList: { width: "100%", marginBottom: 4 },
  miniListScroll: { paddingHorizontal: 16, gap: 8 },
  miniListItem: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 180,
  },
  miniListEmoji: { fontSize: 16 },
  miniListName: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#fff", flex: 1 },
  miniListPts: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.mint },

  ecoBadge: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  ecoBadgeText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  manualOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  manualPanel: {
    backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 16,
  },
  manualTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
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
