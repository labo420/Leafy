import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { router } from "expo-router";
import type { Profile, Voucher, Redemption } from "@workspace/api-client-react";

type RedemptionResult = {
  code: string;
  message: string;
  remainingPoints: number;
};

function VoucherCard({ voucher, userPoints, onRedeem }: {
  voucher: Voucher;
  userPoints: number;
  onRedeem: (v: Voucher) => void;
}) {
  const canAfford = userPoints >= voucher.pointsCost;
  const progressPercent = Math.min((userPoints / voucher.pointsCost) * 100, 100);
  const isAlmostThere = !canAfford && progressPercent >= 80;

  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (isAlmostThere) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        true,
      );
    }
  }, [isAlmostThere]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(50).springify()}>
      <Pressable
        style={[styles.voucherCard, isAlmostThere && styles.voucherCardAlmost]}
        onPress={() => canAfford && onRedeem(voucher)}
      >
        <LinearGradient
          colors={["rgba(244,164,98,0.2)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.voucherGradientHeader}
        >
          <View style={styles.voucherGradientLeft}>
            <View style={styles.voucherCategory}>
              <Feather name="tag" size={10} color={Colors.textSecondary} />
              <Text style={styles.voucherCategoryText}>{voucher.category}</Text>
            </View>
            {isAlmostThere && (
              <Animated.View style={[styles.almostBadge, pulseStyle]}>
                <Feather name="zap" size={10} color={Colors.amber} />
                <Text style={styles.almostBadgeText}>Quasi!</Text>
              </Animated.View>
            )}
          </View>
          <Text style={styles.voucherDiscount}>{voucher.discount}</Text>
        </LinearGradient>

        <View style={styles.voucherBody}>
          <Text style={styles.voucherTitle}>{voucher.title}</Text>
          <Text style={styles.voucherBrand}>{voucher.brandName}</Text>
          <Text style={styles.voucherDesc} numberOfLines={2}>{voucher.description}</Text>

          {!canAfford && (
            <View style={styles.voucherProgressSection}>
              <View style={styles.voucherProgressLabels}>
                <Text style={styles.voucherProgressLabelText}>
                  {new Intl.NumberFormat("it-IT").format(userPoints)} pt
                </Text>
                <Text style={styles.voucherProgressLabelText}>
                  {new Intl.NumberFormat("it-IT").format(voucher.pointsCost)} pt
                </Text>
              </View>
              <View style={styles.voucherProgressTrack}>
                <View
                  style={[
                    styles.voucherProgressFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: isAlmostThere ? Colors.amber : "rgba(46,107,80,0.4)",
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <Pressable
            style={[
              styles.redeemBtn,
              canAfford ? styles.redeemBtnActive : styles.redeemBtnDisabled,
            ]}
            onPress={() => canAfford && onRedeem(voucher)}
            disabled={!canAfford}
          >
            <Text style={[styles.redeemBtnText, !canAfford && styles.redeemBtnTextDisabled]}>
              {canAfford ? "Riscatta ora" : "Punti insufficienti"}
            </Text>
            <View style={[styles.redeemBtnCost, !canAfford && styles.redeemBtnCostDisabled]}>
              <MaterialCommunityIcons name="leaf" size={14} color={canAfford ? "#fff" : Colors.textMuted} />
              <Text style={[styles.redeemBtnCostText, !canAfford && styles.redeemBtnCostTextDisabled]}>
                {voucher.pointsCost.toLocaleString("it-IT")}
              </Text>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function RedemptionCard({ redemption }: { redemption: Redemption }) {
  const [showCode, setShowCode] = useState(false);
  return (
    <Pressable
      style={styles.redemptionCard}
      onPress={() => setShowCode((v) => !v)}
    >
      <View style={styles.redemptionLeft}>
        <Feather name="gift" size={20} color={Colors.amber} />
        <View>
          <Text style={styles.redemptionTitle}>{redemption.voucherTitle ?? "Voucher"}</Text>
          <Text style={styles.redemptionDate}>
            {new Date(redemption.redeemedAt ?? Date.now()).toLocaleDateString("it-IT")}
          </Text>
        </View>
      </View>
      <View style={styles.redemptionRight}>
        {showCode ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{redemption.code}</Text>
          </View>
        ) : (
          <>
            <Feather name="eye" size={16} color={Colors.textSecondary} />
            <Text style={styles.showCodeText}>Mostra</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"vouchers" | "my">("vouchers");
  const [confirmVoucher, setConfirmVoucher] = useState<Voucher | null>(null);
  const [codeModal, setCodeModal] = useState<{ title: string; code: string } | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: !!user,
  });

  const { data: vouchers, isLoading } = useQuery<Voucher[]>({
    queryKey: ["vouchers"],
    queryFn: () => apiFetch("/marketplace/vouchers"),
    enabled: !!user,
  });

  const { data: redemptions } = useQuery<Redemption[]>({
    queryKey: ["redemptions"],
    queryFn: () => apiFetch("/marketplace/redemptions"),
    enabled: !!user,
  });

  const redeemMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<RedemptionResult>(`/marketplace/vouchers/${id}/redeem`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["redemptions"] });
      const voucherTitle = confirmVoucher?.title ?? "Voucher";
      setConfirmVoucher(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCodeModal({ title: voucherTitle, code: data.code });
    },
    onError: (err: Error) => {
      Alert.alert("Errore", err.message);
    },
  });

  const userPoints = profile?.totalPoints ?? 0;

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Ionicons name="gift-outline" size={48} color={Colors.primaryMuted} />
        <Text style={styles.emptyTitle}>Accedi per vedere i premi</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/(tabs)")}>
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Premi</Text>
          <View style={styles.pointsBadge}>
            <MaterialCommunityIcons name="leaf" size={14} color={Colors.leaf} />
            <Text style={styles.pointsBadgeText}>{userPoints.toLocaleString("it-IT")} pt</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabBtn, tab === "vouchers" && styles.tabBtnActive]}
            onPress={() => setTab("vouchers")}
          >
            <Text style={[styles.tabBtnText, tab === "vouchers" && styles.tabBtnTextActive]}>
              Disponibili
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === "my" && styles.tabBtnActive]}
            onPress={() => setTab("my")}
          >
            <Text style={[styles.tabBtnText, tab === "my" && styles.tabBtnTextActive]}>
              I miei codici
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === "vouchers" ? (
        isLoading ? (
          <ActivityIndicator size="large" color={Colors.leaf} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={vouchers ?? []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <VoucherCard
                voucher={item}
                userPoints={userPoints}
                onRedeem={setConfirmVoucher}
              />
            )}
            contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!(vouchers?.length)}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>🎁</Text>
                <Text style={styles.emptyTitle}>I premi arriveranno presto!</Text>
                <Text style={styles.emptySub}>Inizia a scansionare per sbloccarli</Text>
              </View>
            }
          />
        )
      ) : (
        <FlatList
          data={redemptions ?? []}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <RedemptionCard redemption={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(redemptions?.length)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>📦</Text>
              <Text style={styles.emptyTitle}>Nessun codice ancora</Text>
              <Text style={styles.emptySub}>Riscatta i tuoi punti per ottenere voucher</Text>
            </View>
          }
        />
      )}

      {/* Confirm Redeem Modal */}
      {confirmVoucher && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setConfirmVoucher(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setConfirmVoucher(null)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalIcon}>
                <Feather name="gift" size={32} color={Colors.amber} />
              </View>
              <Text style={styles.modalTitle}>Riscatta voucher</Text>
              <Text style={styles.modalBrand}>{confirmVoucher.brandName}</Text>
              <Text style={styles.modalVoucherTitle}>{confirmVoucher.title}</Text>

              <View style={styles.modalCost}>
                <MaterialCommunityIcons name="leaf" size={16} color={Colors.leaf} />
                <Text style={styles.modalCostText}>
                  {confirmVoucher.pointsCost.toLocaleString("it-IT")} punti
                </Text>
              </View>

              <Text style={styles.modalAfter}>
                Punti rimanenti: {(userPoints - confirmVoucher.pointsCost).toLocaleString("it-IT")}
              </Text>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setConfirmVoucher(null)}
                >
                  <Text style={styles.modalCancelText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={styles.modalConfirmBtn}
                  onPress={() => redeemMutation.mutate(confirmVoucher.id)}
                  disabled={redeemMutation.isPending}
                >
                  {redeemMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Riscatta</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Code Result Modal */}
      {codeModal && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setCodeModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.codeModalCard}>
              <LinearGradient
                colors={[Colors.leaf, Colors.mint, Colors.amber]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.codeModalStripe}
              />
              <View style={styles.codeModalCheck}>
                <Feather name="check" size={32} color={Colors.leaf} />
              </View>
              <Text style={styles.codeModalTitle}>Premio Riscattato!</Text>
              <Text style={styles.codeModalSub}>{codeModal.title}</Text>
              <View style={styles.codeModalCodeBox}>
                <Text style={styles.codeModalLabel}>IL TUO CODICE SEGRETO</Text>
                <Text style={styles.codeModalCode}>{codeModal.code}</Text>
              </View>
              <Pressable style={styles.codeModalCloseBtn} onPress={() => setCodeModal(null)}>
                <Text style={styles.codeModalCloseBtnText}>Chiudi e usa il buono</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pointsBadgeText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.cardAlt,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  voucherCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  voucherCardAlmost: {
    borderWidth: 2,
    borderColor: "rgba(244,164,98,0.4)",
  },
  voucherGradientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  voucherGradientLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voucherCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(244,164,98,0.3)",
  },
  voucherCategoryText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  almostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.amber,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  almostBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  voucherDiscount: {
    fontSize: 24,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  voucherBody: {
    padding: 20,
  },
  voucherBrand: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  voucherTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  voucherDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  voucherProgressSection: {
    marginBottom: 16,
  },
  voucherProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  voucherProgressLabelText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  voucherProgressTrack: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  voucherProgressFill: {
    height: 5,
    borderRadius: 3,
  },
  redeemBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  redeemBtnActive: {
    backgroundColor: Colors.leaf,
  },
  redeemBtnDisabled: {
    backgroundColor: Colors.cardAlt,
  },
  redeemBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  redeemBtnTextDisabled: {
    color: Colors.textSecondary,
  },
  redeemBtnCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  redeemBtnCostDisabled: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  redeemBtnCostText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  redeemBtnCostTextDisabled: {
    color: Colors.textMuted,
  },
  redemptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  redemptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  redemptionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  redemptionDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  redemptionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  showCodeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  codeBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  codeText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  loginBtn: {
    marginTop: 20,
    backgroundColor: Colors.leaf,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  modalBrand: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalVoucherTitle: {
    fontSize: 17,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 20,
  },
  modalCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 10,
  },
  modalCostText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
  modalAfter: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.cardAlt,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: Colors.leaf,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  codeModalCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
    overflow: "hidden",
    position: "relative",
  },
  codeModalStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  codeModalCheck: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  codeModalTitle: {
    fontSize: 24,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  codeModalSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: "center",
  },
  codeModalCodeBox: {
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    width: "100%",
    alignItems: "center",
  },
  codeModalLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  codeModalCode: {
    fontSize: 28,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: 4,
  },
  codeModalCloseBtn: {
    backgroundColor: Colors.leaf,
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  codeModalCloseBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
