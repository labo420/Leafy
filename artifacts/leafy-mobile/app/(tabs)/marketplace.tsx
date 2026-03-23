import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PayPalLogo from "@/components/PayPalLogo";
import { LeaIcon } from "@/components/LeaIcon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import LeafyGoldModal from "@/components/LeafyGoldModal";
import { apiFetch } from "@/lib/api";

type Withdrawal = {
  id: number;
  leaAmount: string;
  euroAmount: string;
  status: "pending" | "completed" | "rejected";
  requestedAt: string;
  processedAt: string | null;
};

function statusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "completed":
      return { label: "Completato", color: "#4ade80" };
    case "rejected":
      return { label: "Rifiutato", color: "#f87171" };
    default:
      return { label: "In elaborazione", color: "#FACC15" };
  }
}

function formatLea(n: number): string {
  return Math.floor(n).toLocaleString("it-IT", { maximumFractionDigits: 0 });
}

const PAYPAL_BLUE = "#0070E0";
const LEA_COLOR = "#AADF2A";

const RING_SIZE = 300;
const STROKE_WIDTH = 18;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_SWEEP = 0.78;

function LeaHeroRing({ leaBalance }: { leaBalance: number }) {
  const scale = useSharedValue(0.72);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 90 });
    opacity.value = withTiming(1, { duration: 420 });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const activeArcLength = CIRCUMFERENCE * ARC_SWEEP;
  const rotationDeg = -90 - (1 - ARC_SWEEP) * 180;

  return (
    <Animated.View style={[styles.heroContainer, containerStyle]}>
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ transform: [{ rotate: `${rotationDeg}deg` }] }}
      >
        <Defs>
          <SvgLinearGradient id="leaArcGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#38D47A" stopOpacity="1" />
            <Stop offset="0.5" stopColor={LEA_COLOR} stopOpacity="1" />
            <Stop offset="1" stopColor="#38D47A" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(170,223,42,0.12)"
          strokeWidth={STROKE_WIDTH}
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#leaArcGrad)"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={`${activeArcLength} ${CIRCUMFERENCE - activeArcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.heroCenter}>
        <LeaIcon size={36} />
        <Text style={styles.heroAmount}>{formatLea(leaBalance)}</Text>
        <Text style={styles.heroLeaLabel}>LEA</Text>
      </View>
    </Animated.View>
  );
}


export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, leaBalance, hasLeafyGold, refreshBalances } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [showLeafyGold, setShowLeafyGold] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [leaInput, setLeaInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshBalances(),
      queryClient.invalidateQueries({ queryKey: ["wallet-withdrawals"] }),
    ]);
    setRefreshing(false);
  }, [refreshBalances, queryClient]);

  const topPadding = Platform.OS === "web" ? 67 : 0;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  const leaAmount = Math.floor(parseFloat(leaInput.replace(",", ".")) || 0);
  const minLea = hasLeafyGold ? 500 : 1000;

  let validationError: string | null = null;
  if (leaInput.length > 0) {
    if (leaAmount <= 0) {
      validationError = "Inserisci un importo valido.";
    } else if (leaAmount > leaBalance) {
      validationError = "Saldo $LEA insufficiente.";
    } else if (leaAmount < minLea) {
      validationError = `Importo minimo: ${minLea.toLocaleString("it-IT")} $LEA${hasLeafyGold ? " con Leafy Gold" : ""}.`;
    }
  }

  const canConvert = leaInput.length > 0 && leaAmount > 0 && !validationError;

  const { data: withdrawals, isLoading: loadingWithdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["wallet-withdrawals"],
    queryFn: () => apiFetch("/wallet/withdrawals"),
    enabled: !!user,
    staleTime: 30_000,
  });

  const { mutate: submitWithdrawal, isPending: isSubmitting } = useMutation({
    mutationFn: () =>
      apiFetch<Withdrawal>("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ leaAmount }),
      }),
    onSuccess: () => {
      setShowConfirm(false);
      setLeaInput("");
      setShowWithdrawForm(false);
      setSubmitError(null);
      setSuccessMsg(`Prelievo di ${formatLea(leaAmount)} $LEA registrato! Elaborazione entro 24h.`);
      refreshBalances();
      queryClient.invalidateQueries({ queryKey: ["wallet-withdrawals"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: Error) => {
      setShowConfirm(false);
      setSubmitError(err.message);
    },
  });

  const handlePayPalPress = useCallback(() => {
    if (!hasLeafyGold) {
      setShowLeafyGold(true);
      return;
    }
    setShowWithdrawForm((v) => !v);
    setLeaInput("");
    setSubmitError(null);
  }, [hasLeafyGold]);

  const handleMax = useCallback(() => {
    setLeaInput(String(Math.floor(leaBalance)));
  }, [leaBalance]);

  const handleConfirmPress = useCallback(() => {
    if (!canConvert) return;
    setSubmitError(null);
    setShowConfirm(true);
  }, [canConvert]);

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Feather name="credit-card" size={48} color={theme.textMuted} />
        <Text style={[styles.guestTitle, { color: theme.text }]}>Il tuo Wallet</Text>
        <Text style={[styles.guestSub, { color: theme.textSecondary }]}>Accedi per vedere il tuo saldo $LEA.</Text>
      </View>
    );
  }

  return (
    <>
      <LeafyGoldModal visible={showLeafyGold} onClose={() => setShowLeafyGold(false)} />

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <Pressable style={styles.overlay} onPress={() => !isSubmitting && setShowConfirm(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: theme.card }]} onPress={() => {}}>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Conferma prelievo</Text>

            <View style={styles.confirmSummary}>
              <View style={[styles.confirmPanel, { backgroundColor: "rgba(0,112,224,0.08)", borderColor: "rgba(0,112,224,0.25)" }]}>
                <Text style={[styles.confirmPanelLabel, { color: PAYPAL_BLUE }]}>Prelevi</Text>
                <Text style={[styles.confirmPanelAmount, { color: theme.text }]}>
                  {formatLea(leaAmount)} <Text style={{ fontSize: 14 }}>$LEA</Text>
                </Text>
              </View>
            </View>

            <Text style={[styles.confirmNote, { color: theme.textSecondary }]}>
              Il pagamento sarà elaborato entro 24h sul tuo account PayPal.
            </Text>

            <View style={styles.confirmBtnRow}>
              <Pressable
                style={[styles.confirmBtnCancel, { borderColor: theme.border }]}
                onPress={() => setShowConfirm(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.confirmBtnCancelText, { color: theme.textSecondary }]}>Annulla</Text>
              </Pressable>

              <Pressable
                style={[styles.confirmBtnConfirm, { backgroundColor: PAYPAL_BLUE }]}
                onPress={() => submitWithdrawal()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnConfirmText}>Conferma</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={[styles.container, { backgroundColor: "rgba(77,184,71,0.18)" }]}
          contentContainerStyle={{ paddingTop: topPadding + 20, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PAYPAL_BLUE}
              colors={[PAYPAL_BLUE]}
            />
          }
        >
          <View style={styles.content}>
            <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.heroSection}>
              <LeaHeroRing leaBalance={leaBalance} />

              {hasLeafyGold && (
                <View style={styles.goldBadge}>
                  <Image source={require("@/assets/images/leafy-gold-icon.png")} style={{ width: 14, height: 14 }} resizeMode="contain" />
                  <Text style={styles.goldBadgeText}>Leafy Gold · $LEA x2</Text>
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <Pressable
                style={({ pressed }) => [styles.paypalBtn, { opacity: pressed ? 0.88 : 1 }]}
                onPress={handlePayPalPress}
              >
                <PayPalLogo width={160} height={38} />
              </Pressable>
            </Animated.View>

            {showWithdrawForm && (
              <Animated.View entering={FadeIn.duration(220)} style={[styles.withdrawCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.withdrawInputRow}>
                  <TextInput
                    style={[styles.withdrawInput, { color: theme.text }]}
                    value={leaInput}
                    onChangeText={(v) => {
                      setLeaInput(v.replace(/[^0-9,\.]/g, ""));
                      setSubmitError(null);
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    autoFocus
                  />
                  <View style={[styles.leaBadge, { backgroundColor: "rgba(0,112,224,0.10)" }]}>
                    <Text style={[styles.leaBadgeText, { color: PAYPAL_BLUE }]}>$LEA</Text>
                  </View>
                  <Pressable style={[styles.maxBtn, { backgroundColor: "rgba(0,112,224,0.10)" }]} onPress={handleMax}>
                    <Text style={[styles.maxBtnText, { color: PAYPAL_BLUE }]}>MAX</Text>
                  </Pressable>
                </View>

                <Text style={[styles.withdrawAvail, { color: theme.textMuted }]}>
                  Disponibile: {formatLea(leaBalance)} $LEA · Min: {minLea.toLocaleString("it-IT")} $LEA
                </Text>

                {(validationError || submitError) && (
                  <Animated.View entering={FadeIn} style={[styles.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
                    <Feather name="alert-circle" size={14} color="#DC2626" />
                    <Text style={styles.errorText}>{validationError ?? submitError}</Text>
                  </Animated.View>
                )}

                {successMsg && (
                  <Animated.View entering={FadeIn} style={[styles.successBox, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                    <Feather name="check-circle" size={14} color="#16A34A" />
                    <Text style={styles.successText}>{successMsg}</Text>
                  </Animated.View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.confirmWithdrawBtn,
                    {
                      backgroundColor: canConvert ? PAYPAL_BLUE : theme.textMuted,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  onPress={handleConfirmPress}
                  disabled={!canConvert}
                >
                  <Text style={styles.confirmWithdrawBtnText}>Conferma prelievo</Text>
                </Pressable>
              </Animated.View>
            )}

            {successMsg && !showWithdrawForm && (
              <Animated.View entering={FadeIn} style={[styles.successBox, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                <Feather name="check-circle" size={14} color="#16A34A" />
                <Text style={styles.successText}>{successMsg}</Text>
              </Animated.View>
            )}

            {!hasLeafyGold && (
              <Animated.View entering={FadeInDown.delay(180).springify()}>
                <Pressable style={styles.bpPromoCard} onPress={() => setShowLeafyGold(true)}>
                  <LinearGradient colors={["#0f2a1e", "#1a4a2e"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.bpPromoLeft}>
                    <View style={styles.bpPromoIconWrap}>
                      <Image source={require("@/assets/images/leafy-gold-icon.png")} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bpPromoTitle}>Leafy Gold</Text>
                      <Text style={styles.bpPromoSub}>Raddoppia i $LEA · Sblocca i prelievi</Text>
                    </View>
                  </View>
                  <View style={styles.bpPromoBtn}>
                    <Text style={styles.bpPromoBtnText}>Attiva</Text>
                  </View>
                </Pressable>
              </Animated.View>
            )}

            {user && (
              <Animated.View entering={FadeInDown.delay(240).springify()} style={[styles.historySection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.historySectionTitle, { color: theme.text }]}>Prelievi recenti</Text>

                {loadingWithdrawals && (
                  <ActivityIndicator color={PAYPAL_BLUE} style={{ marginVertical: 16 }} />
                )}

                {!loadingWithdrawals && (!withdrawals || withdrawals.length === 0) && (
                  <Text style={[styles.historyEmpty, { color: theme.textMuted }]}>Nessun prelievo ancora.</Text>
                )}

                {!loadingWithdrawals && withdrawals && withdrawals.slice(0, 5).map((w) => {
                  const { label, color } = statusLabel(w.status);
                  const date = new Date(w.requestedAt).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <View key={w.id} style={[styles.historyRow, { borderBottomColor: theme.border }]}>
                      <View style={[styles.historyIconWrap, { backgroundColor: "rgba(0,112,224,0.10)" }]}>
                        <Feather name="arrow-up-right" size={16} color={PAYPAL_BLUE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyAmount, { color: theme.text }]}>
                          -{Math.floor(parseFloat(w.leaAmount)).toLocaleString("it-IT")} $LEA
                        </Text>
                        <Text style={[styles.historyDate, { color: theme.textMuted }]}>{date}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${color}22` }]}>
                        <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.infoSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Come funziona $LEA</Text>
              {[
                { icon: "camera" as const, text: "Scansiona uno scontrino e guadagna drops" },
                { icon: "maximize" as const, text: "Scansiona i barcode per ottenere $LEA extra" },
                { icon: "zap" as const, text: "Con Leafy Gold ogni $LEA è raddoppiato (x2)" },
              ].map((item, i) => (
                <View key={i} style={styles.infoRow}>
                  <View style={[styles.infoRowIcon, { backgroundColor: theme.primaryLight }]}>
                    <Feather name={item.icon} size={16} color={theme.leaf} />
                  </View>
                  <Text style={[styles.infoRowText, { color: theme.text }]}>{item.text}</Text>
                </View>
              ))}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F8FF" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  guestTitle: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    textAlign: "center",
  },
  guestSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },

  content: {
    paddingHorizontal: 20,
    gap: 16,
  },

  heroSection: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  heroContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  heroAmount: {
    fontSize: 52,
    fontFamily: "DMSans_700Bold",
    color: "#ffffff",
    lineHeight: 58,
    letterSpacing: -0.5,
  },
  heroLeaLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#AADF2A",
    letterSpacing: 0.5,
  },

  goldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFD700",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  goldBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1a4a2e",
  },

  paypalBtn: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#CCCCCC",
  },

  withdrawCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  withdrawInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  withdrawInput: {
    flex: 1,
    fontSize: 32,
    fontFamily: "DMSans_700Bold",
    padding: 0,
    minHeight: 40,
  },
  leaBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  leaBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  maxBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  maxBtnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  withdrawAvail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#DC2626",
    flex: 1,
    lineHeight: 18,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  successText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#16A34A",
    flex: 1,
    lineHeight: 18,
  },

  confirmWithdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  confirmWithdrawBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
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

  historySection: {
    borderRadius: 20,
    padding: 20,
    gap: 0,
    borderWidth: 1,
  },
  historySectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  historyEmpty: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 12,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  historyAmount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  infoSection: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
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
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    textAlign: "center",
  },
  confirmSummary: {
    gap: 4,
    alignItems: "center",
  },
  confirmPanel: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  confirmPanelLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  confirmPanelAmount: {
    fontSize: 26,
    fontFamily: "DMSans_700Bold",
  },
  confirmNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  confirmBtnCancel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  confirmBtnConfirm: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnConfirmText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
