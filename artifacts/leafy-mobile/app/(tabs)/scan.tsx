import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { router } from "expo-router";
import type { ScanResult } from "@workspace/api-client-react";

type ScanState = "idle" | "preview" | "scanning" | "result";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScanState>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const scanMutation = useMutation({
    mutationFn: (imageBase64: string) =>
      apiFetch<ScanResult>("/scan", {
        method: "POST",
        body: JSON.stringify({ imageBase64 }),
      }),
    onSuccess: (data) => {
      setResult(data);
      setState("result");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      Alert.alert("Errore", err.message ?? "Impossibile analizzare lo scontrino");
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
      result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.8,
        mediaTypes: "images",
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.8,
        mediaTypes: "images",
      });
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
    setResult(null);
  };

  if (state === "result" && result) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.forest, Colors.leaf]}
          style={[styles.resultHeader, { paddingTop: topPadding + 16 }]}
        >
          <Animated.View entering={FadeIn.delay(100)}>
            <View style={styles.resultIconWrap}>
              <Feather name="check-circle" size={56} color="#fff" />
            </View>
            <Text style={styles.resultTitle}>Ottimo acquisto!</Text>
            <Text style={styles.resultSub}>{result.message}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.pointsEarned}>
            <Text style={styles.pointsLabel}>Punti guadagnati</Text>
            <Text style={styles.pointsValue}>+{result.pointsEarned}</Text>
            <Text style={styles.totalPoints}>Totale: {result.totalPoints.toLocaleString("it-IT")}</Text>
          </Animated.View>
        </LinearGradient>

        {result.greenItemsFound.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Prodotti green trovati</Text>
            {result.greenItemsFound.map((item, i) => (
              <View key={i} style={styles.greenItem}>
                <View style={styles.greenItemLeft}>
                  <View style={styles.greenDot} />
                  <View>
                    <Text style={styles.greenItemName}>{item.name}</Text>
                    <Text style={styles.greenItemCat}>{item.category}</Text>
                  </View>
                </View>
                <Text style={styles.greenItemPoints}>+{item.points} pt</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {result.badges.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Nuovo badge sbloccato!</Text>
            {result.badges.map((b, i) => (
              <View key={i} style={styles.badgeCard}>
                <Feather name="award" size={28} color={Colors.amber} />
                <View>
                  <Text style={styles.badgeName}>{b.name}</Text>
                  <Text style={styles.badgeDesc}>{b.description}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={styles.section}>
          <Pressable style={styles.primaryBtn} onPress={reset}>
            <Feather name="camera" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Scansiona un altro</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (state === "scanning") {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <LinearGradient
          colors={[Colors.primaryLight, Colors.background]}
          style={StyleSheet.absoluteFill}
        />
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.scanningImage} />
        )}
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.scanningText}>Analisi in corso...</Text>
          <Text style={styles.scanningSubText}>Stiamo identificando i prodotti green</Text>
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
            <Text style={styles.primaryBtnText}>Analizza</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.idleHeader}>
        <Text style={styles.idleTitle}>Scansiona</Text>
        <Text style={styles.idleSub}>Fotografa il tuo scontrino per guadagnare punti green</Text>
      </View>

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

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>Suggerimenti</Text>
        {[
          "Assicurati che lo scontrino sia leggibile",
          "Scatta in buona luce per risultati migliori",
          "Includi l'intero scontrino nell'inquadratura",
        ].map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <View style={styles.tipDot} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  idleHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  idleTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 8,
  },
  idleSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  idleOptions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  optionCardPressed: { opacity: 0.88 },
  optionGradient: {
    padding: 24,
    alignItems: "center",
    gap: 10,
    minHeight: 180,
    justifyContent: "center",
  },
  optionSecondary: {
    padding: 24,
    alignItems: "center",
    gap: 10,
    minHeight: 180,
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 20,
  },
  optionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  optionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  tips: {
    paddingHorizontal: 24,
    gap: 8,
  },
  tipsTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryMuted,
  },
  tipText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  previewImage: {
    flex: 1,
    width: "100%",
  },
  previewActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.leaf,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: Colors.leaf,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.leaf,
  },
  scanningImage: {
    width: "90%",
    height: "60%",
    borderRadius: 16,
    opacity: 0.4,
  },
  scanningOverlay: {
    position: "absolute",
    alignItems: "center",
    gap: 12,
  },
  scanningText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 12,
  },
  scanningSubText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  resultHeader: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "center",
  },
  resultIconWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  resultSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  pointsEarned: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    width: "100%",
  },
  pointsLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pointsValue: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 56,
  },
  totalPoints: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
  },
  greenItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  greenItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  greenItemName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  greenItemCat: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  greenItemPoints: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.amber,
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  badgeDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
