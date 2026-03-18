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

const LEA_TO_EUR = 0.01;

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, leaBalance, hasBattlePass } = useAuth();
  const [showBattlePass, setShowBattlePass] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  const euroValue = leaBalance * LEA_TO_EUR;

  const formattedLea = leaBalance.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedEuro = euroValue.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (!user) {
    return (
      <View style={styles.centered}>
        <Feather name="credit-card" size={48} color={Colors.textMuted} />
        <Text style={styles.guestTitle}>Il tuo Wallet</Text>
        <Text style={styles.guestSub}>Accedi per vedere il tuo saldo $LEA.</Text>
      </View>
    );
  }

  return (
    <>
      <BattlePassModal visible={showBattlePass} onClose={() => setShowBattlePass(false)} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: topPadding + 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Mio Wallet</Text>

            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>{formattedLea}</Text>
              <Text style={styles.balanceCurrency}>$LEA</Text>
            </View>

            <Text style={styles.balanceEuro}>≈ {formattedEuro} €</Text>

            {hasBattlePass && (
              <View style={styles.bpActiveBadge}>
                <Feather name="star" size={12} color="#1a4a2e" />
                <Text style={styles.bpActiveBadgeText}>Battle Pass attivo · $LEA x2</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).springify()}>
            <Pressable
              style={[styles.withdrawBtn, !hasBattlePass && styles.withdrawBtnLocked]}
              onPress={() => {
                if (hasBattlePass) {
                  console.log("Prelievo avviato");
                } else {
                  setShowBattlePass(true);
                }
              }}
            >
              {!hasBattlePass && (
                <Feather name="lock" size={18} color={Colors.textSecondary} />
              )}
              <Text style={[styles.withdrawBtnText, !hasBattlePass && styles.withdrawBtnTextLocked]}>
                Ritira su PayPal
              </Text>
              {hasBattlePass && (
                <Feather name="arrow-right" size={18} color="#fff" />
              )}
            </Pressable>
          </Animated.View>

          {!hasBattlePass && (
            <Animated.View entering={FadeInDown.delay(200).springify()}>
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

  content: {
    paddingHorizontal: 20,
    gap: 16,
  },

  balanceCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.leaf,
    padding: 24,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  balanceAmount: {
    fontSize: 52,
    fontFamily: "DMSans_700Bold",
    color: Colors.primaryDeep,
    lineHeight: 58,
  },
  balanceCurrency: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    marginBottom: 6,
  },
  balanceEuro: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
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
    marginTop: 10,
  },
  bpActiveBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },

  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  withdrawBtnLocked: {
    backgroundColor: Colors.cardAlt,
  },
  withdrawBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  withdrawBtnTextLocked: {
    color: Colors.textSecondary,
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
