import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  remainingReceiptPoints?: number;
  receiptCapPts?: number;
  dailyCapPts?: number;
  isManual?: boolean;
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
  remainingReceiptPoints?: number;
  receiptCapPts?: number;
  dailyCapPts?: number;
  bonusVirtuoso?: boolean;
  bonusVirtuosoPts?: number;
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

type ScanPhase = "scanning" | "looking-up" | "preview" | "confirming" | "confirmed" | "manual-form" | "manual-classifying";

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
  const { receiptId: receiptIdStr, productName: productNameParam } = useLocalSearchParams<{ receiptId: string; productName?: string }>();
  const receiptId = parseInt(receiptIdStr ?? "0", 10);
  const targetProductName = productNameParam ?? null;
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [phase, setPhase] = useState<ScanPhase>("scanning");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [lastConfirmed, setLastConfirmed] = useState<ConfirmResult | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const lastBarcodeRef = useRef<string>("");
  const [manualName, setManualName] = useState("");
  const [manualWeight, setManualWeight] = useState("");
  const [manualUnit, setManualUnit] = useState<"g" | "kg">("g");
  const [manualFrontPhoto, setManualFrontPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [manualBackPhoto, setManualBackPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [cameFromReject, setCameFromReject] = useState(false);

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
    mutationFn: (params: { barcode: string; imageBase64?: string }) =>
      apiFetch<LookupResult>("/scan/barcode/lookup", {
        method: "POST",
        body: JSON.stringify({ barcode: params.barcode, receiptId, imageBase64: params.imageBase64 }),
      }),
    onSuccess: (data) => {
      setLookupData(data);
      setPhase("preview");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (err: Error) => {
      const msg = err.message ?? "";
      if (msg.toLowerCase().includes("già stato scansionato") || msg.toLowerCase().includes("limite")) {
        setPhase("scanning");
        setCooldown(true);
        setTimeout(() => setCooldown(false), 2000);
        Alert.alert("Attenzione", msg);
      } else {
        setManualName("");
        setManualWeight("");
        setManualUnit("g");
        setManualFrontPhoto(null);
        setManualBackPhoto(null);
        setPhase("manual-form");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const manualMutation = useMutation({
    mutationFn: (params: { name: string; weightValue: number; weightUnit: "g" | "kg"; frontImageBase64?: string; backImageBase64?: string }) =>
      apiFetch<LookupResult>("/scan/barcode/manual-classify", {
        method: "POST",
        body: JSON.stringify({
          barcode: lastBarcodeRef.current,
          receiptId,
          name: params.name,
          weightValue: params.weightValue,
          weightUnit: params.weightUnit,
          frontImageBase64: params.frontImageBase64,
          backImageBase64: params.backImageBase64,
        }),
      }),
    onSuccess: (data) => {
      setLookupData(data);
      setCameFromReject(false);
      setPhase("preview");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (err: Error) => {
      setPhase("manual-form");
      Alert.alert("Errore", err.message ?? "Impossibile classificare il prodotto");
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
    async ({ data }: { data: string }) => {
      if (phase !== "scanning" || cooldown) return;
      setPhase("looking-up");
      lastBarcodeRef.current = data;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let imageBase64: string | undefined;
      try {
        if (cameraRef.current && Platform.OS !== "web") {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.2,
            skipProcessing: true,
          });
          if (photo?.base64) {
            imageBase64 = photo.base64;
          }
        }
      } catch {}

      lookupMutation.mutate({ barcode: data, imageBase64 });
    },
    [phase, cooldown],
  );

  const takeManualPhoto = async (side: "front" | "back") => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permesso negato", "Abilita l'accesso alla fotocamera nelle impostazioni");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: "images" });
    if (!result.canceled && result.assets[0]) {
      const { uri, base64 } = result.assets[0];
      if (base64) {
        if (side === "front") setManualFrontPhoto({ uri, base64 });
        else setManualBackPhoto({ uri, base64 });
      }
    }
  };

  const submitManualEntry = () => {
    const weightNum = parseFloat(manualWeight.replace(",", "."));
    if (!manualName.trim() || manualName.trim().length < 2) {
      Alert.alert("Attenzione", "Inserisci il nome del prodotto (minimo 2 caratteri).");
      return;
    }
    if (!manualWeight || isNaN(weightNum) || weightNum <= 0) {
      Alert.alert("Attenzione", "Inserisci un peso valido.");
      return;
    }
    if (!manualFrontPhoto && !manualBackPhoto) {
      Alert.alert("Attenzione", "Scatta almeno una foto della confezione.");
      return;
    }
    setPhase("manual-classifying");
    manualMutation.mutate({
      name: manualName.trim(),
      weightValue: weightNum,
      weightUnit: manualUnit,
      frontImageBase64: manualFrontPhoto?.base64,
      backImageBase64: manualBackPhoto?.base64,
    });
  };

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

  const finishAndGoBack = () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["receipts"] });
    queryClient.invalidateQueries({ queryKey: ["active-session"] });
    router.back();
  };

  const handleManualSearch = () => {
    const code = manualCode.trim();
    if (code.length < 8) return;
    setShowManualInput(false);
    setManualCode("");
    setPhase("looking-up");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lookupMutation.mutate({ barcode: code });
  };

  const finish = () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["receipts"] });
    router.back();
  };

  const totalPointsEarned = scannedProducts.reduce((s, p) => s + p.pointsEarned, 0);

  if (Platform.OS !== "web") {
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
  }

  if (phase === "preview" && lookupData) {
    const isGeneric = lookupData.source === "ai-fallback" || lookupData.source === "ai" || lookupData.productName.startsWith("Prodotto ");
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

        <Animated.View entering={FadeInDown.delay(200)} style={styles.previewConfirmQuestion}>
          <Feather name="help-circle" size={16} color={Colors.text} />
          <Text style={styles.previewConfirmText}>Il prodotto rilevato è corretto?</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250)} style={styles.previewActions}>
          <Pressable
            style={styles.rejectBtn}
            onPress={() => {
              setManualName("");
              setManualWeight("");
              setManualUnit("g");
              setManualFrontPhoto(null);
              setManualBackPhoto(null);
              setCameFromReject(true);
              setPhase("manual-form");
            }}
          >
            <Feather name="edit-2" size={18} color={Colors.leaf} />
            <Text style={[styles.rejectBtnText, { color: Colors.leaf }]}>No, aggiungi</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Sì, aggiungi</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350)} style={styles.previewHintBox}>
          <Feather name="info" size={14} color={Colors.textSecondary} />
          <Text style={styles.previewHintText}>
            Conferma solo se hai acquistato questo prodotto
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

            {lastConfirmed.bonusVirtuoso && (
              <View style={styles.virtuosoChip}>
                <Text style={styles.virtuosoChipIcon}>⭐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.virtuosoChipTitle}>Scontrino Virtuoso!</Text>
                  <Text style={styles.virtuosoChipSub}>3+ prodotti green +{lastConfirmed.bonusVirtuosoPts} pt bonus</Text>
                </View>
              </View>
            )}
          </Animated.View>
        </LinearGradient>

        <View style={styles.capsInfoBar}>
          <Feather name="info" size={12} color={Colors.textSecondary} />
          <Text style={styles.capsInfoText}>
            Max {lastConfirmed.receiptCapPts ?? 150} pt/scontrino · {lastConfirmed.dailyCapPts ?? 200} pt/giorno
          </Text>
          <Text style={styles.capsInfoRemaining}>
            Rimasti: {Math.max(0, lastConfirmed.remainingReceiptPoints ?? 0)} scontrino · {Math.max(0, lastConfirmed.remainingDailyPoints ?? 0)} oggi
          </Text>
        </View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.resultActions}>
          {targetProductName ? (
            <>
              <Pressable style={styles.primaryBtn} onPress={finishAndGoBack}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Torna alla lista</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={continueScan}>
                <MaterialCommunityIcons name="barcode-scan" size={18} color={Colors.leaf} />
                <Text style={styles.secondaryBtnText}>Scansiona ancora</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.primaryBtn} onPress={continueScan}>
                <Feather name="camera" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Scansiona altro</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={finish}>
                <Feather name="check" size={18} color={Colors.leaf} />
                <Text style={styles.secondaryBtnText}>Finito ({totalPointsEarned} pt)</Text>
              </Pressable>
            </>
          )}
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

  if (phase === "manual-classifying") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.leaf} />
        <Text style={styles.processingFullText}>Classificazione in corso...</Text>
        <Text style={[styles.processingFullText, { fontSize: 14, color: Colors.textSecondary, marginTop: 4 }]}>
          Claude sta analizzando il prodotto
        </Text>
      </View>
    );
  }

  if (phase === "manual-form") {
    const weightNum = parseFloat(manualWeight.replace(",", "."));
    const canSubmit = manualName.trim().length >= 2 && !isNaN(weightNum) && weightNum > 0 && (manualFrontPhoto !== null || manualBackPhoto !== null);
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: topPadding }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.manualFormHeader}>
            <Pressable
              onPress={() => {
                if (cameFromReject) {
                  setCameFromReject(false);
                  setPhase("preview");
                } else {
                  setPhase("scanning");
                }
              }}
              style={styles.manualFormBack}
            >
              <Feather name={cameFromReject ? "arrow-left" : "x"} size={22} color={Colors.text} />
            </Pressable>
            <Text style={styles.manualFormTitle}>
              {cameFromReject ? "Correggi prodotto" : "Inserimento manuale"}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.manualFormSection}>
            <Text style={styles.manualFormLabel}>Nome prodotto *</Text>
            <TextInput
              style={styles.manualFormInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Es. Pane integrale Mulino Bianco"
              placeholderTextColor={Colors.textSecondary}
              returnKeyType="next"
              autoFocus
            />
          </View>

          <View style={styles.manualFormSection}>
            <Text style={styles.manualFormLabel}>Peso / Quantità *</Text>
            <View style={styles.manualWeightRow}>
              <TextInput
                style={[styles.manualFormInput, { flex: 1, marginRight: 10 }]}
                value={manualWeight}
                onChangeText={setManualWeight}
                placeholder="Es. 500"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <View style={styles.unitToggle}>
                <Pressable
                  style={[styles.unitBtn, manualUnit === "g" && styles.unitBtnActive]}
                  onPress={() => setManualUnit("g")}
                >
                  <Text style={[styles.unitBtnText, manualUnit === "g" && styles.unitBtnTextActive]}>g</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitBtn, manualUnit === "kg" && styles.unitBtnActive]}
                  onPress={() => setManualUnit("kg")}
                >
                  <Text style={[styles.unitBtnText, manualUnit === "kg" && styles.unitBtnTextActive]}>kg</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.manualFormSection}>
            <Text style={styles.manualFormLabel}>Foto confezione * (almeno una)</Text>
            <Text style={styles.manualFormSublabel}>Includi il codice a barre nel fronte o retro</Text>
            <View style={styles.photoRow}>
              <Pressable style={styles.photoBtn} onPress={() => takeManualPhoto("front")}>
                {manualFrontPhoto ? (
                  <Image source={{ uri: manualFrontPhoto.uri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Feather name="camera" size={28} color={Colors.textSecondary} />
                    <Text style={styles.photoBtnLabel}>Fronte</Text>
                  </View>
                )}
                {manualFrontPhoto && (
                  <View style={styles.photoCheckBadge}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
              <Pressable style={styles.photoBtn} onPress={() => takeManualPhoto("back")}>
                {manualBackPhoto ? (
                  <Image source={{ uri: manualBackPhoto.uri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Feather name="camera" size={28} color={Colors.textSecondary} />
                    <Text style={styles.photoBtnLabel}>Retro</Text>
                    <Text style={styles.photoBtnSublabel}>con barcode</Text>
                  </View>
                )}
                {manualBackPhoto && (
                  <View style={styles.photoCheckBadge}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.manualSubmitBtn, !canSubmit && styles.manualSubmitBtnDisabled]}
            onPress={submitManualEntry}
            disabled={!canSubmit}
          >
            <Feather name="zap" size={18} color="#fff" />
            <Text style={styles.manualSubmitBtnText}>Classifica con AI</Text>
          </Pressable>

          <Pressable style={styles.manualCancelScan} onPress={() => setPhase("scanning")}>
            <Text style={styles.manualCancelScanText}>← Torna alla scansione</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <Pressable onPress={finish} style={{ padding: 8 }}>
            <Feather name="x" size={24} color={Colors.text} />
          </Pressable>
          <Text style={[styles.cameraTitle, { color: Colors.text, flex: 1, textAlign: "center" }]}>Scansiona prodotto</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.centered, { flex: 1, paddingHorizontal: 32 }]}>
          <MaterialCommunityIcons name="barcode-scan" size={64} color={Colors.leaf} />
          <Text style={styles.permTitle}>Inserisci codice a barre</Text>
          <Text style={styles.permSub}>La fotocamera non è disponibile su web. Inserisci il codice del prodotto manualmente.</Text>
          <TextInput
            style={[styles.manualInput, { width: "100%", marginTop: 24 }]}
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
          <Pressable
            style={[styles.permBtn, { marginTop: 12, flexDirection: "row", gap: 8, alignSelf: "stretch", justifyContent: "center", opacity: manualCode.trim().length < 8 || phase === "looking-up" ? 0.5 : 1 }]}
            onPress={handleManualSearch}
            disabled={manualCode.trim().length < 8 || phase === "looking-up"}
          >
            {phase === "looking-up" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="search" size={16} color="#fff" />
            )}
            <Text style={styles.permBtnText}>Cerca prodotto</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        ref={cameraRef}
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
          {targetProductName ? (
            <View style={styles.targetProductBanner}>
              <MaterialCommunityIcons name="barcode-scan" size={16} color={Colors.leaf} />
              <Text style={styles.targetProductText} numberOfLines={1}>
                Stai verificando: {targetProductName}
              </Text>
            </View>
          ) : (
            <Text style={styles.cameraHint}>Inquadra il codice a barre del prodotto</Text>
          )}
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
  targetProductBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, maxWidth: 320,
  },
  targetProductText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff", flex: 1,
  },
  previewConfirmQuestion: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4,
  },
  previewConfirmText: {
    fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text,
  },
  manualEntryLink: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  manualEntryLinkText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.leaf,
    textDecorationLine: "underline",
  },
  manualFormHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  manualFormBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
  },
  manualFormTitle: {
    fontSize: 18, fontFamily: "DMSans_700Bold", color: Colors.text,
  },
  manualFormSection: {
    paddingHorizontal: 20, marginBottom: 18,
  },
  manualFormLabel: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text,
    marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5,
  },
  manualFormSublabel: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary,
    marginBottom: 10,
  },
  manualFormInput: {
    backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  manualWeightRow: {
    flexDirection: "row", alignItems: "center",
  },
  unitToggle: {
    flexDirection: "row", backgroundColor: Colors.card, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, overflow: "hidden",
  },
  unitBtn: {
    paddingHorizontal: 16, paddingVertical: 13,
    alignItems: "center", justifyContent: "center",
  },
  unitBtnActive: {
    backgroundColor: Colors.leaf,
  },
  unitBtnText: {
    fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary,
  },
  unitBtnTextActive: {
    color: "#fff",
  },
  photoRow: {
    flexDirection: "row", gap: 12,
  },
  photoBtn: {
    flex: 1, borderRadius: 14, overflow: "hidden",
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed",
    minHeight: 120, position: "relative",
  },
  photoPreview: {
    width: "100%", height: 120, resizeMode: "cover",
  },
  photoPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 16, gap: 6, minHeight: 120, backgroundColor: Colors.card,
  },
  photoBtnLabel: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary,
  },
  photoBtnSublabel: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary,
  },
  photoCheckBadge: {
    position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.leaf, alignItems: "center", justifyContent: "center",
  },
  manualSubmitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.leaf, borderRadius: 16, paddingVertical: 16,
    marginHorizontal: 20, marginTop: 8, marginBottom: 12,
  },
  manualSubmitBtnDisabled: {
    opacity: 0.4,
  },
  manualSubmitBtnText: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff",
  },
  manualCancelScan: {
    alignItems: "center", paddingVertical: 8,
  },
  manualCancelScanText: {
    fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary,
  },
  virtuosoChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
  },
  virtuosoChipIcon: { fontSize: 22 },
  virtuosoChipTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  virtuosoChipSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  capsInfoBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.card, flexWrap: "wrap",
  },
  capsInfoText: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary, flex: 1,
  },
  capsInfoRemaining: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.leaf,
  },
});
