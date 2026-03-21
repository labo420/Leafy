import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useCallback } from "react";
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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import LeafyGoldModal from "@/components/LeafyGoldModal";
import { apiFetch } from "@/lib/api";

const LEA_TO_EUR = 0.01;

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
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatEur(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, leaBalance, hasLeafyGold, refreshBalances } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [showLeafyGold, setShowLeafyGold] = useState(false);
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

  const leaAmount = parseFloat(leaInput.replace(",", ".")) || 0;
  const euroAmount = leaAmount * LEA_TO_EUR;
  const minLea = hasLeafyGold ? 500 : 1000;

  let validationError: string | null = null;
  if (leaInput.length > 0) {
    if (leaAmount <= 0) {
      validationError = "Inserisci un importo valido.";
    } else if (leaAmount > leaBalance) {
      validationError = "Saldo $LEA insufficiente.";
    } else if (leaAmount < minLea) {
      validationError = `Importo minimo: ${minLea.toLocaleString("it-IT")} $LEA (${formatEur(minLea * LEA_TO_EUR)} €)${hasLeafyGold ? " con Leafy Gold" : ""}.`;
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
    onSuccess: (data) => {
      setShowConfirm(false);
      setLeaInput("");
      setSubmitError(null);
      setSuccessMsg(`Prelievo di ${formatEur(parseFloat(data.euroAmount))} € registrato! Elaborazione entro 24h.`);
      refreshBalances();
      queryClient.invalidateQueries({ queryKey: ["wallet-withdrawals"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: Error) => {
      setShowConfirm(false);
      setSubmitError(err.message);
    },
  });

  const handleConvert = useCallback(() => {
    if (!hasLeafyGold) {
      setShowLeafyGold(true);
      return;
    }
    if (!canConvert) return;
    setSubmitError(null);
    setShowConfirm(true);
  }, [hasLeafyGold, canConvert]);

  const handleMax = useCallback(() => {
    setLeaInput(leaBalance.toFixed(2).replace(".", ","));
  }, [leaBalance]);

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
              <View style={[styles.confirmPanel, { backgroundColor: theme.primaryLight, borderColor: theme.leaf }]}>
                <Text style={[styles.confirmPanelLabel, { color: theme.primary }]}>Paghi</Text>
                <Text style={[styles.confirmPanelAmount, { color: theme.primaryDeep }]}>
                  {formatLea(leaAmount)} <Text style={{ fontSize: 14 }}>$LEA</Text>
                </Text>
              </View>

              <View style={styles.confirmArrow}>
                <Feather name="arrow-down" size={20} color={theme.primary} />
              </View>

              <View style={[styles.confirmPanel, { backgroundColor: theme.primaryLight, borderColor: theme.leaf }]}>
                <Text style={[styles.confirmPanelLabel, { color: theme.primary }]}>Ricevi</Text>
                <Text style={[styles.confirmPanelAmount, { color: theme.primaryDeep }]}>
                  {formatEur(euroAmount)} <Text style={{ fontSize: 14 }}>€</Text>
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
                style={[styles.confirmBtnConfirm, { backgroundColor: theme.primary }]}
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
          style={[styles.container, { backgroundColor: theme.background }]}
          contentContainerStyle={{ paddingTop: topPadding + 20, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          <View style={styles.content}>
            <Animated.View entering={FadeInDown.delay(80).springify()} style={[styles.balanceCard, { backgroundColor: theme.primaryLight, borderColor: theme.leaf }]}>
              <Text style={[styles.balanceLabel, { color: theme.primary }]}>Mio Wallet</Text>

              <View style={styles.balanceRow}>
                <Text style={[styles.balanceAmount, { color: theme.primaryDeep }]}>{formatLea(leaBalance)}</Text>
                <Text style={[styles.balanceCurrency, { color: theme.primary }]}>$LEA</Text>
              </View>

              <Text style={[styles.balanceEuro, { color: theme.textSecondary }]}>≈ {formatEur(leaBalance * LEA_TO_EUR)} €</Text>

              {hasLeafyGold && (
                <View style={styles.bpActiveBadge}>
                  <Image source={require("@/assets/images/leafy-gold-icon.png")} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={styles.bpActiveBadgeText}>Leafy Gold attivo · $LEA x2</Text>
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(140).springify()} style={[styles.swapCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.swapTitle, { color: theme.text }]}>Converti $LEA in €</Text>
              <Text style={[styles.swapRate, { color: theme.textSecondary }]}>Tasso: 1 $LEA = 0,01 €</Text>

              <View style={[styles.swapPanel, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.swapPanelHeader}>
                  <Text style={[styles.swapPanelLabel, { color: theme.textSecondary }]}>Paghi</Text>
                  <Pressable style={[styles.maxBtn, { backgroundColor: theme.primaryLight }]} onPress={handleMax}>
                    <Text style={[styles.maxBtnText, { color: theme.primary }]}>MAX</Text>
                  </Pressable>
                </View>
                <View style={styles.swapInputRow}>
                  <TextInput
                    style={[styles.swapInput, { color: theme.text }]}
                    value={leaInput}
                    onChangeText={(v) => {
                      setLeaInput(v.replace(/[^0-9,\.]/g, ""));
                      setSubmitError(null);
                    }}
                    placeholder="0,00"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                  <View style={[styles.currencyBadge, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.currencyBadgeText, { color: theme.primary }]}>$LEA</Text>
                  </View>
                </View>
                <Text style={[styles.swapBalance, { color: theme.textMuted }]}>
                  Disponibile: {formatLea(leaBalance)} $LEA
                </Text>
              </View>

              <View style={styles.swapArrowWrap}>
                <View style={[styles.swapArrowCircle, { backgroundColor: theme.primaryLight, borderColor: theme.leaf }]}>
                  <Feather name="arrow-down" size={18} color={theme.primary} />
                </View>
              </View>

              <View style={[styles.swapPanel, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.swapPanelLabel, { color: theme.textSecondary }]}>Ricevi</Text>
                <View style={styles.swapInputRow}>
                  <Text style={[styles.swapOutputAmount, { color: leaAmount > 0 ? theme.primaryDeep : theme.textMuted }]}>
                    {leaAmount > 0 ? formatEur(euroAmount) : "0,00"}
                  </Text>
                  <View style={[styles.currencyBadge, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.currencyBadgeText, { color: theme.primary }]}>€</Text>
                  </View>
                </View>
              </View>

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
                  styles.convertBtn,
                  {
                    backgroundColor:
                      !hasLeafyGold
                        ? theme.textSecondary
                        : canConvert
                        ? theme.primary
                        : theme.textMuted,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={handleConvert}
                disabled={hasLeafyGold && !canConvert}
              >
                {!hasLeafyGold ? (
                  <>
                    <Feather name="lock" size={16} color="#fff" />
                    <Text style={styles.convertBtnText}>Sblocca con Leafy Gold</Text>
                  </>
                ) : (
                  <>
                    <Feather name="repeat" size={16} color="#fff" />
                    <Text style={styles.convertBtnText}>Converti in €</Text>
                  </>
                )}
              </Pressable>

              {!hasLeafyGold && (
                <Text style={[styles.swapLockNote, { color: theme.textMuted }]}>
                  I prelievi richiedono Leafy Gold attivo.
                </Text>
              )}
              {hasLeafyGold && (
                <Text style={[styles.swapLockNote, { color: theme.textMuted }]}>
                  Minimo: {minLea.toLocaleString("it-IT")} $LEA · Elaborazione entro 24h
                </Text>
              )}
            </Animated.View>

            {!hasLeafyGold && (
              <Animated.View entering={FadeInDown.delay(200).springify()}>
                <Pressable style={styles.bpPromoCard} onPress={() => setShowBattlePass(true)}>
                  <LinearGradient colors={["#0f2a1e", "#1a4a2e"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.bpPromoLeft}>
                    <View style={styles.bpPromoIconWrap}>
                      <Image source={require("@/assets/images/leafy-gold-icon.png")} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bpPromoTitle}>Leafy Gold · 0,89€/mese</Text>
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
              <Animated.View entering={FadeInDown.delay(260).springify()} style={[styles.historySection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.historySectionTitle, { color: theme.text }]}>Prelievi recenti</Text>

                {loadingWithdrawals && (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 16 }} />
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
                      <View style={[styles.historyIconWrap, { backgroundColor: theme.primaryLight }]}>
                        <Feather name="arrow-up-right" size={16} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyAmount, { color: theme.text }]}>
                          -{parseFloat(w.leaAmount).toLocaleString("it-IT", { minimumFractionDigits: 2 })} $LEA → {parseFloat(w.euroAmount).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
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

            <Animated.View entering={FadeInDown.delay(340).springify()} style={[styles.infoSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Come funziona $LEA</Text>
              {[
                { icon: "camera" as const, text: "Scansiona uno scontrino e guadagna XP" },
                { icon: "maximize" as const, text: "Scansiona i barcode per ottenere $LEA extra" },
                { icon: "dollar-sign" as const, text: "1 XP = 0,01€ in $LEA" },
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
  container: { flex: 1 },
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

  balanceCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
    lineHeight: 58,
  },
  balanceCurrency: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  balanceEuro: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
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

  swapCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  swapTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  swapRate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  swapPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  swapPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  swapPanelLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  maxBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  maxBtnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  swapInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  swapInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
    padding: 0,
    minHeight: 36,
  },
  swapOutputAmount: {
    flex: 1,
    fontSize: 28,
    fontFamily: "DMSans_700Bold",
  },
  currencyBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currencyBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  swapBalance: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  swapArrowWrap: {
    alignItems: "center",
    marginVertical: -4,
    zIndex: 1,
  },
  swapArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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

  convertBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  convertBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  swapLockNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: -4,
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
  confirmArrow: {
    alignItems: "center",
    paddingVertical: 4,
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
