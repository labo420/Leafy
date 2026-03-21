import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/context/theme";
import { useAuth } from "@/context/auth";

interface BattlePassModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BattlePassModal({ visible, onClose }: BattlePassModalProps) {
  const { activateBattlePass, hasBattlePass } = useAuth();
  const { theme, mode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);

  const handleActivate = async () => {
    setLoading(true);
    // TODO: Integrare qui il gateway di pagamento (es. Stripe o RevenueCat) per l'abbonamento reale.
    await activateBattlePass();
    setLoading(false);
    setActivated(true);
    setTimeout(() => {
      setActivated(false);
      onClose();
    }, 1800);
  };

  const features = [
    { icon: "zap" as const, text: "Raddoppia i $LEA su ogni scontrino" },
    { icon: "dollar-sign" as const, text: "Sblocca i prelievi su PayPal" },
    { icon: "trending-up" as const, text: "Moltiplica i guadagni ogni mese" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.modalBackground }]} onPress={() => {}}>
          <LinearGradient
            colors={mode === "dark" ? ["#0f2a1e", "#1a4a2e", "#0f2a1e"] : ["#1E3328", "#2E6B50", "#1E3328"]}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View entering={FadeIn.delay(100)} style={styles.goldAccentLine} />

          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.header}>
            <View style={styles.iconWrap}>
              <Image
                source={require("@/assets/images/battle-pass-icon.png")}
                style={{ width: 72, height: 72 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.badge}>BATTLE PASS</Text>
            <Text style={styles.title}>Passa a Premium</Text>
            <Text style={styles.subtitle}>Sblocca il massimo potenziale di Leafy</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.featureList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon} size={16} color="#FFD700" />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.priceWrap}>
            <Text style={styles.priceLabel}>Solo</Text>
            <Text style={styles.price}>0,89€</Text>
            <Text style={styles.pricePer}>/mese</Text>
          </Animated.View>

          {hasBattlePass || activated ? (
            <Animated.View entering={FadeIn} style={styles.activatedRow}>
              <Feather name="check-circle" size={20} color="#4ade80" />
              <Text style={styles.activatedText}>Battle Pass attivo!</Text>
            </Animated.View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
              onPress={handleActivate}
              disabled={loading}
            >
              <LinearGradient
                colors={["#FFD700", "#FFA500"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#1a4a2e" />
                ) : (
                  <>
                    <Feather name="zap" size={18} color="#1a4a2e" />
                    <Text style={styles.ctaText}>Attiva Battle Pass</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Non ora</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  goldAccentLine: {
    height: 3,
    marginBottom: 24,
    borderRadius: 2,
    backgroundColor: "#FFD700",
    opacity: 0.8,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconWrap: {
    marginBottom: 12,
  },
  badge: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  featureList: {
    gap: 14,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
    flex: 1,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  price: {
    fontSize: 36,
    fontFamily: "DMSans_700Bold",
    color: "#FFD700",
  },
  pricePer: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  ctaBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },
  activatedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginBottom: 12,
  },
  activatedText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#4ade80",
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  closeText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
});
