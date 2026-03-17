import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import BattlePassModal from "@/components/BattlePassModal";

const XP_TO_EUR = 0.01;

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, leaBalance, hasBattlePass } = useAuth();
  const [showBattlePass, setShowBattlePass] = useState(false);
  const [showWithdrawInfo, setShowWithdrawInfo] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  const euroValue = leaBalance * XP_TO_EUR;

  if (!user) {
    return (
      <View style={styles.centered}>
        <Feather name="credit-card" size={48} color={Colors.textMuted} />
        <Text style={styles.guestTitle}>Il tuo Wallet</Text>
        <Text style={styles.guestSub}>Accedi per vedere il tuo saldo $LEA e prelevare i guadagni.</Text>
      </View>
    );
  }

  return (
    <>
      <BattlePassModal visible={showBattlePass} onClose={() => setShowBattlePass(false)} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.forest, Colors.leaf]}
          style={[styles.headerGrad, { paddingTop: topPadding + 12 }]}
        >
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text style={styles.headerLabel}>Saldo $LEA</Text>
            <Text style={styles.headerBalance}>{leaBalance.toFixed(4)}</Text>
            <Text style={styles.headerEuro}>≈ {euroValue.toFixed(2)}€</Text>

            {hasBattlePass && (
              <View style={styles.bpActiveBadge}>
                <Feather name="star" size={12} color="#1a4a2e" />
                <Text style={styles.bpActiveBadgeText}>Battle Pass attivo · $LEA x2</Text>
              </View>
            )}
          </Animated.View>
        </LinearGradient>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(160).springify()}>
            <Pressable
              style={[styles.withdrawCard, !hasBattlePass && styles.withdrawCardLocked]}
              onPress={() => {
                if (!hasBattlePass) {
                  setShowBattlePass(true);
                } else {
                  setShowWithdrawInfo(true);
                }
              }}
            >
              {hasBattlePass ? (
                <LinearGradient
                  colors={["#3a8f65", Colors.leaf]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.withdrawGrad}
                >
                  <View style={styles.withdrawIconWrap}>
                    <Feather name="dollar-sign" size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.withdrawTitle}>Ritira su PayPal</Text>
                    <Text style={styles.withdrawSub}>Invia i tuoi $LEA al tuo account PayPal</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              ) : (
                <View style={styles.withdrawLocked}>
                  <View style={styles.withdrawLockedIcon}>
                    <Feather name="lock" size={22} color={Colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.withdrawLockedTitle}>Ritira su PayPal</Text>
                    <Text style={styles.withdrawLockedSub}>Richiede Battle Pass attivo</Text>
                  </View>
                  <View style={styles.unlockChip}>
                    <Text style={styles.unlockChipText}>Sblocca</Text>
                  </View>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {showWithdrawInfo && hasBattlePass && (
            <Animated.View entering={FadeInDown.springify()} style={styles.infoBox}>
              <Feather name="info" size={16} color={Colors.leaf} />
              <Text style={styles.infoText}>
                La funzione di prelievo PayPal sarà disponibile a breve. Continua ad accumulare $LEA!
              </Text>
            </Animated.View>
          )}

          {!hasBattlePass && (
            <Animated.View entering={FadeInDown.delay(220).springify()}>
              <Pressable style={styles.bpPromoCard} onPress={() => setShowBattlePass(true)}>
                <LinearGradient
                  colors={["#0f2a1e", "#1a4a2e"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.bpPromoLeft}>
                  <View style={styles.bpPromoIconWrap}>
                    <Feather name="star" size={22} color="#FFD700" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bpPromoTitle}>Battle Pass · 0,89€/mese</Text>
                    <Text style={styles.bpPromoSub}>Raddoppia i $LEA · Sblocca i prelievi</Text>
                  </View>
                </View>
                <View style={styles.bpPromoBtn}>
                  <Text style={styles.bpPromoBtnText}>Attiva</Text>
                </View>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Come funziona $LEA</Text>
            {[
              { icon: "camera" as const, text: "Scansiona uno scontrino e guadagna XP" },
              { icon: "maximize" as const, text: "Scansiona i barcode per ottenere $LEA extra" },
              { icon: "dollar-sign" as const, text: "1 XP = 0,01€ in $LEA" },
              { icon: "zap" as const, text: "Con Battle Pass ogni $LEA è raddoppiato (x2)" },
            ].map((item, i) => (
              <View key={i} style={styles.infoRow}>
                <View style={styles.infoRowIcon}>
                  <Feather name={item.icon} size={16} color={Colors.leaf} />
                </View>
                <Text style={styles.infoRowText}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>
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
    padding: 32,
    backgroundColor: Colors.background,
    gap: 12,
  },
  guestTitle: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  guestSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  headerGrad: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  headerBalance: {
    fontSize: 52,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
    lineHeight: 60,
  },
  headerEuro: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  bpActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFD700",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  bpActiveBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },

  content: {
    padding: 20,
    gap: 16,
  },

  withdrawCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  withdrawCardLocked: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
  },
  withdrawGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
  },
  withdrawIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  withdrawSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  withdrawLocked: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 20,
  },
  withdrawLockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawLockedTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  withdrawLockedSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  unlockChip: {
    backgroundColor: "#FFD700",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unlockChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    flex: 1,
    lineHeight: 19,
  },

  bpPromoCard: {
    borderRadius: 20,
    overflow: "hidden",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  bpPromoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  bpPromoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,215,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bpPromoTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  bpPromoSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  bpPromoBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bpPromoBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },

  infoSection: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
});
