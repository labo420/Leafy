import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";
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
  const canAfford = userPoints >= voucher.pointsRequired;
  return (
    <Animated.View entering={FadeInDown.delay(50).springify()}>
      <Pressable
        style={[styles.voucherCard, !canAfford && styles.voucherCardDisabled]}
        onPress={() => canAfford && onRedeem(voucher)}
      >
        <View style={styles.voucherTop}>
          <View style={[styles.voucherCategory, !canAfford && styles.voucherCategoryDisabled]}>
            <Text style={styles.voucherCategoryText}>{voucher.category}</Text>
          </View>
          <View style={styles.voucherPointsBox}>
            <MaterialCommunityIcons name="leaf" size={12} color={canAfford ? Colors.leaf : Colors.textMuted} />
            <Text style={[styles.voucherPoints, !canAfford && styles.voucherPointsDisabled]}>
              {voucher.pointsRequired.toLocaleString("it-IT")}
            </Text>
          </View>
        </View>

        <Text style={styles.voucherBrand}>{voucher.brand}</Text>
        <Text style={styles.voucherTitle}>{voucher.title}</Text>
        <Text style={styles.voucherDesc} numberOfLines={2}>{voucher.description}</Text>

        <View style={styles.voucherBottom}>
          <Text style={styles.voucherValue}>
            {voucher.discountType === "percent"
              ? `-${voucher.discountValue}%`
              : `€${voucher.discountValue} off`}
          </Text>
          {voucher.expiresAt && (
            <Text style={styles.voucherExpiry}>
              Scade {new Date(voucher.expiresAt).toLocaleDateString("it-IT")}
            </Text>
          )}
        </View>

        {!canAfford && (
          <View style={styles.voucherLock}>
            <Feather name="lock" size={12} color={Colors.textMuted} />
            <Text style={styles.voucherLockText}>
              Ti mancano {(voucher.pointsRequired - userPoints).toLocaleString("it-IT")} punti
            </Text>
          </View>
        )}
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
          <Text style={styles.redemptionTitle}>{(redemption as any).voucherTitle ?? "Voucher"}</Text>
          <Text style={styles.redemptionDate}>
            {new Date((redemption as any).redeemedAt ?? Date.now()).toLocaleDateString("it-IT")}
          </Text>
        </View>
      </View>
      <View style={styles.redemptionRight}>
        {showCode ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{(redemption as any).code}</Text>
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

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

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
      setConfirmVoucher(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Riscattato!", `Il tuo codice: ${data.code}\nPunti rimanenti: ${data.remainingPoints}`);
    },
    onError: (err: Error) => {
      Alert.alert("Errore", err.message);
    },
  });

  const userPoints = profile?.points ?? 0;

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Ionicons name="gift-outline" size={48} color={Colors.primaryMuted} />
        <Text style={styles.emptyTitle}>Accedi per vedere i premi</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
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
                <Ionicons name="gift-outline" size={48} color={Colors.primaryMuted} />
                <Text style={styles.emptyTitle}>Nessun premio disponibile</Text>
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
              <Feather name="inbox" size={48} color={Colors.primaryMuted} />
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
              <Text style={styles.modalBrand}>{confirmVoucher.brand}</Text>
              <Text style={styles.modalVoucherTitle}>{confirmVoucher.title}</Text>

              <View style={styles.modalCost}>
                <MaterialCommunityIcons name="leaf" size={16} color={Colors.leaf} />
                <Text style={styles.modalCostText}>
                  {confirmVoucher.pointsRequired.toLocaleString("it-IT")} punti
                </Text>
              </View>

              <Text style={styles.modalAfter}>
                Punti rimanenti: {(userPoints - confirmVoucher.pointsRequired).toLocaleString("it-IT")}
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
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  voucherCardDisabled: {
    opacity: 0.65,
  },
  voucherTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  voucherCategory: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  voucherCategoryDisabled: {
    backgroundColor: Colors.cardAlt,
  },
  voucherCategoryText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.leaf,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  voucherPointsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voucherPoints: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
  voucherPointsDisabled: {
    color: Colors.textMuted,
  },
  voucherBrand: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  voucherTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    marginBottom: 6,
  },
  voucherDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  voucherBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  voucherValue: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.primary,
  },
  voucherExpiry: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  voucherLock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  voucherLockText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
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
});
