import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { router } from "expo-router";
import type { Receipt, ReceiptDetail } from "@workspace/api-client-react";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function ReceiptDetailSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery<ReceiptDetail>({
    queryKey: ["receipt", id],
    queryFn: () => apiFetch(`/receipts/${id}`),
  });

  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Dettagli scontrino</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.leaf} style={{ marginTop: 40 }} />
        ) : data ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.detailHeader}>
              <View style={styles.detailPoints}>
                <MaterialCommunityIcons name="leaf" size={20} color={Colors.leaf} />
                <Text style={styles.detailPointsText}>+{data.pointsEarned} punti</Text>
              </View>
              {data.storeName && <Text style={styles.detailStore}>{data.storeName}</Text>}
              {data.scannedAt && <Text style={styles.detailDate}>{formatDate(data.scannedAt)}</Text>}
            </View>

            {data.items && data.items.length > 0 && (
              <>
                <Text style={styles.itemsTitle}>Prodotti green ({data.items.length})</Text>
                {data.items.map((item: any, i: number) => (
                  <View key={i} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <View style={styles.itemDot} />
                      <View>
                        <Text style={styles.itemName}>{item.itemName}</Text>
                        <Text style={styles.itemCat}>{item.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemPts}>+{item.pointsAwarded} pt</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function ReceiptCard({ receipt, onPress }: { receipt: Receipt; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(50).springify()}>
      <Pressable
        style={({ pressed }) => [styles.receiptCard, pressed && { opacity: 0.85 }]}
        onPress={onPress}
      >
        <View style={styles.receiptLeft}>
          <View style={styles.receiptIcon}>
            <Feather name="file-text" size={20} color={Colors.leaf} />
          </View>
          <View>
            <Text style={styles.receiptStore}>
              {receipt.storeName ?? "Negozio sconosciuto"}
            </Text>
            <Text style={styles.receiptDate}>{formatDate(receipt.scannedAt)}</Text>
            {receipt.categories.length > 0 && (
              <View style={styles.catRow}>
                {receipt.categories.slice(0, 2).map((c, i) => (
                  <View key={i} style={styles.catBadge}>
                    <Text style={styles.catText}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        <View style={styles.receiptRight}>
          <Text style={styles.receiptPoints}>+{receipt.pointsEarned}</Text>
          <Text style={styles.receiptPointsLabel}>pt</Text>
          <Text style={styles.receiptItems}>{receipt.greenItemsCount} green</Text>
          <Feather name="chevron-right" size={16} color={Colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function StoricoScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100;

  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["receipts"],
    queryFn: () => apiFetch("/receipts"),
    enabled: !!user,
  });

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Feather name="list" size={48} color={Colors.primaryMuted} />
        <Text style={styles.emptyTitle}>Accedi per vedere lo storico</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Storico</Text>
        <Text style={styles.subtitle}>
          {receipts?.length ?? 0} scontrini scansionati
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.leaf} style={{ marginTop: 40 }} />
      ) : !receipts || receipts.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={56} color={Colors.primaryMuted} />
          <Text style={styles.emptyTitle}>Nessuno scontrino ancora</Text>
          <Text style={styles.emptySub}>Scansiona il tuo primo scontrino per guadagnare punti green</Text>
          <Pressable style={styles.scanBtn} onPress={() => router.push("/(tabs)/scan")}>
            <Feather name="camera" size={16} color="#fff" />
            <Text style={styles.scanBtnText}>Scansiona ora</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ReceiptCard receipt={item} onPress={() => setSelectedId(item.id)} />
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!receipts?.length}
        />
      )}

      {selectedId !== null && (
        <ReceiptDetailSheet id={selectedId} onClose={() => setSelectedId(null)} />
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
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  receiptCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  receiptLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  receiptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptStore: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  receiptDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  catRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  catBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.leaf,
  },
  receiptRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  receiptPoints: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
  receiptPointsLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  receiptItems: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
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
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.leaf,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  scanBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
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
  sheetContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  detailHeader: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    gap: 6,
  },
  detailPoints: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  detailPointsText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
  detailStore: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  detailDate: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  itemsTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  itemCat: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  itemPts: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.leaf,
  },
});
