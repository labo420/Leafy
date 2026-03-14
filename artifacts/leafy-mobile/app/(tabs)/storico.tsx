import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { apiFetch, apiBase } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { router } from "expo-router";

interface Receipt {
  id: number;
  storeName: string | null;
  storeChain: string | null;
  province: string | null;
  purchaseDate: string | null;
  pointsEarned: number;
  greenItemsCount: number;
  categories: string[];
  scannedAt: string;
  status: string | null;
  isPending: boolean;
  remainingHours: number;
  pendingProductsCount: number;
}

interface BarcodeScanItem {
  id: number;
  barcode: string;
  productName: string;
  ecoScore: string | null;
  pointsEarned: number;
  category: string;
  emoji: string;
  reasoning: string;
  scannedAt: string;
}

interface GreenItem {
  name: string;
  category: string | null;
  points: number;
  emoji: string | null;
  matched?: boolean;
  barcode?: string | null;
  ecoScore?: string | null;
}

interface ReceiptDetailData {
  id: number;
  storeName: string | null;
  storeChain: string | null;
  province: string | null;
  purchaseDate: string | null;
  pointsEarned: number;
  greenItems: GreenItem[];
  scannedAt: string;
  barcodeExpiry: string | null;
  barcodeScans: BarcodeScanItem[];
  hasImage: boolean;
  imageExpiresAt: string | null;
  status: string | null;
  isPending: boolean;
  remainingHours: number;
}

const ECO_COLORS: Record<string, string> = {
  a: "#1E8C45",
  b: "#60AC0E",
  c: "#FECB02",
  d: "#EE8100",
  e: "#E63E11",
};

const CATEGORY_COLORS = Colors.categoryColors;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatProductName(name: string): string {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

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

function useReceiptImage(id: number, hasImage: boolean) {
  return useQuery<string | null>({
    queryKey: ["receipt-image", id],
    queryFn: async () => {
      const url = `${apiBase()}/receipts/${id}/image`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    },
    enabled: hasImage,
  });
}

function ReceiptDetailSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<ReceiptDetailData>({
    queryKey: ["receipt", id],
    queryFn: () => apiFetch(`/receipts/${id}`),
  });

  const [editingItem, setEditingItem] = useState<GreenItem | null>(null);
  const [correctionText, setCorrectionText] = useState("");

  const correctMutation = useMutation({
    mutationFn: ({ originalName, correctedName }: { originalName: string; correctedName: string }) =>
      apiFetch("/scan/products/correct", {
        method: "POST",
        body: JSON.stringify({ receiptId: id, originalName, correctedName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt", id] });
      setEditingItem(null);
      setCorrectionText("");
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile correggere il nome. Riprova.");
    },
  });

  const openEdit = (item: GreenItem) => {
    setEditingItem(item);
    setCorrectionText(item.name);
  };

  const confirmCorrection = () => {
    if (!editingItem || !correctionText.trim()) return;
    correctMutation.mutate({ originalName: editingItem.name, correctedName: correctionText.trim() });
  };

  const { data: imageData } = useReceiptImage(id, data?.hasImage ?? false);

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

            {data.isPending && (
              <View style={styles.pendingBanner}>
                <View style={styles.pendingBannerTop}>
                  <Feather name="clock" size={18} color={Colors.amber} />
                  <Text style={styles.pendingBannerTitle}>Verifica in sospeso</Text>
                </View>
                <Text style={styles.pendingBannerSub}>
                  Hai ancora {data.remainingHours} ore per scansionare i barcode dei prodotti green
                </Text>
              </View>
            )}

            <View style={styles.detailHeader}>
              <View style={styles.detailPoints}>
                <MaterialCommunityIcons name="leaf" size={20} color={Colors.leaf} />
                <Text style={styles.detailPointsText}>+{data.pointsEarned} punti</Text>
              </View>
              {data.storeName && <Text style={styles.detailStore}>{data.storeName}</Text>}
              <View style={styles.detailMetaRow}>
                {data.scannedAt && <Text style={styles.detailDate}>{formatDate(data.scannedAt)}</Text>}
                {data.province && (
                  <View style={styles.detailProvince}>
                    <Feather name="map-pin" size={12} color={Colors.textSecondary} />
                    <Text style={styles.detailProvinceText}>{data.province}</Text>
                  </View>
                )}
              </View>
            </View>

            {data.hasImage && imageData && (
              <View style={styles.imageSection}>
                <Image
                  source={{ uri: imageData }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
                {data.imageExpiresAt && (
                  <View style={styles.imageExpiry}>
                    <Feather name="clock" size={12} color={Colors.textSecondary} />
                    <Text style={styles.imageExpiryText}>
                      Foto disponibile fino al {formatDate(data.imageExpiresAt)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {data.barcodeScans && data.barcodeScans.length > 0 && (
              <>
                <Text style={styles.itemsTitle}>
                  Prodotti scansionati ({data.barcodeScans.length})
                </Text>
                {data.barcodeScans.map((scan) => (
                  <View key={scan.id} style={styles.barcodeRow}>
                    <View style={styles.barcodeLeft}>
                      <Text style={styles.barcodeEmoji}>{scan.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.barcodeName} numberOfLines={1}>
                          {scan.productName}
                        </Text>
                        <View style={styles.barcodeMeta}>
                          <Text style={styles.barcodeCat}>{scan.category}</Text>
                          {scan.reasoning ? (
                            <Text style={styles.barcodeReason} numberOfLines={1}>
                              {scan.reasoning}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <View style={styles.barcodeRight}>
                      <EcoScoreBadge score={scan.ecoScore} />
                      <Text style={styles.barcodePts}>+{scan.pointsEarned}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {data.greenItems && data.greenItems.length > 0 && (
              <>
                <View style={styles.itemsTitleRow}>
                  <Text style={[styles.itemsTitle, { marginTop: 16 }]}>
                    Prodotti green ({data.greenItems.length})
                  </Text>
                  {!data.isPending && <Text style={styles.itemsHint}>Tocca ✏️ per correggere</Text>}
                </View>
                {data.greenItems.map((item, i) => {
                  const isUnmatched = data.isPending && item.matched === false;
                  const isMatched = data.isPending && item.matched === true;
                  return (
                    <View key={i} style={[styles.itemRow, isMatched && styles.itemRowMatched]}>
                      <Text style={styles.itemEmoji}>{item.emoji ?? "🌿"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{formatProductName(item.name)}</Text>
                        <Text style={styles.itemCat}>{item.category ?? ""}</Text>
                      </View>
                      {isMatched && (
                        <View style={styles.verifiedBadge}>
                          <Feather name="check" size={12} color={Colors.leaf} />
                          <Text style={styles.verifiedBadgeText}>+{item.points} pt</Text>
                        </View>
                      )}
                      {isUnmatched && (
                        <Pressable
                          style={styles.scanItemBtn}
                          onPress={() => {
                            onClose();
                            router.push({ pathname: "/barcode-scanner", params: { receiptId: String(data.id), productName: item.name } });
                          }}
                        >
                          <MaterialCommunityIcons name="barcode-scan" size={14} color="#fff" />
                          <Text style={styles.scanItemBtnText}>Scansiona</Text>
                        </Pressable>
                      )}
                      {!data.isPending && (
                        <>
                          <Text style={styles.itemPts}>+{item.points} pt</Text>
                          <Pressable
                            style={styles.editBtn}
                            onPress={() => openEdit(item)}
                            hitSlop={8}
                          >
                            <Feather name="edit-2" size={14} color={Colors.textSecondary} />
                          </Pressable>
                        </>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {(!data.barcodeScans || data.barcodeScans.length === 0) &&
             (!data.greenItems || data.greenItems.length === 0) && (
              <View style={styles.noProductsMsg}>
                <Feather name="info" size={20} color={Colors.textSecondary} />
                <Text style={styles.noProductsText}>
                  Nessun prodotto scansionato per questo scontrino
                </Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>

      {editingItem && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setEditingItem(null)}>
          <View style={styles.correctionOverlay}>
            <View style={styles.correctionSheet}>
              <Text style={styles.correctionTitle}>Correggi il nome</Text>
              <Text style={styles.correctionSub}>
                Il sistema imparerà per le prossime scansioni.
              </Text>
              <TextInput
                style={styles.correctionInput}
                value={correctionText}
                onChangeText={setCorrectionText}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmCorrection}
                placeholder="Nome corretto del prodotto"
                placeholderTextColor={Colors.textMuted}
              />
              <View style={styles.correctionActions}>
                <Pressable
                  style={styles.correctionCancel}
                  onPress={() => setEditingItem(null)}
                >
                  <Text style={styles.correctionCancelText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.correctionConfirm,
                    (!correctionText.trim() || correctMutation.isPending) && { opacity: 0.5 },
                  ]}
                  onPress={confirmCorrection}
                  disabled={!correctionText.trim() || correctMutation.isPending}
                >
                  {correctMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.correctionConfirmText}>Conferma</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
        <View style={styles.receiptTop}>
          <View style={styles.receiptLeft}>
            <View style={[styles.receiptIcon, receipt.isPending && styles.receiptIconPending]}>
              {receipt.isPending
                ? <Feather name="clock" size={20} color={Colors.amber} />
                : <Feather name="shopping-bag" size={20} color={Colors.leaf} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.receiptStore}>
                {receipt.storeName ?? "Negozio sconosciuto"}
              </Text>
              <View style={styles.receiptMetaRow}>
                <Text style={styles.receiptDate}>{formatDate(receipt.scannedAt)}</Text>
                {receipt.province && (
                  <View style={styles.provinceBadge}>
                    <Feather name="map-pin" size={10} color={Colors.textSecondary} />
                    <Text style={styles.provinceText}>{receipt.province}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {receipt.isPending ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>⏳ {receipt.remainingHours}h</Text>
            </View>
          ) : (
            <View style={styles.receiptPointsBadge}>
              <Text style={styles.receiptPointsBadgeText}>+{receipt.pointsEarned} pts</Text>
            </View>
          )}
        </View>

        {receipt.isPending && receipt.pendingProductsCount > 0 && (
          <View style={styles.pendingInfoRow}>
            <MaterialCommunityIcons name="barcode-scan" size={13} color={Colors.amber} />
            <Text style={styles.pendingInfoText}>
              {receipt.pendingProductsCount} prodott{receipt.pendingProductsCount === 1 ? "o" : "i"} da verificare
            </Text>
          </View>
        )}

        {!receipt.isPending && receipt.categories && receipt.categories.length > 0 && (
          <View style={styles.catRow}>
            <Text style={styles.catCountText}>{receipt.greenItemsCount} prodotti:</Text>
            {receipt.categories.map((cat, idx) => {
              const color = CATEGORY_COLORS[cat] || { bg: Colors.cardAlt, text: Colors.textSecondary };
              return (
                <View key={idx} style={[styles.catBadge, { backgroundColor: color.bg }]}>
                  <Text style={[styles.catText, { color: color.text }]}>{cat}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function StoricoScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

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
          <Text style={{ fontSize: 56 }}>📭</Text>
          <Text style={styles.emptyTitle}>Nessuno scontrino ancora</Text>
          <Text style={styles.emptySub}>Il tuo primo scontrino vale punti green! 🎯</Text>
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
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.background, padding: 32,
  },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 32, fontFamily: "DMSans_700Bold", color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  receiptCard: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  receiptTop: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12,
  },
  receiptLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  receiptIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  receiptStore: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 2 },
  receiptDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  receiptMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  provinceBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  provinceText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  receiptPointsBadge: {
    backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  receiptPointsBadgeText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.leaf,
  },
  catRow: {
    flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center",
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  catCountText: {
    fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginRight: 2,
  },
  catBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  catText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "DMSans_700Bold", color: Colors.text, textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.leaf, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8,
  },
  scanBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  loginBtn: { marginTop: 20, backgroundColor: Colors.leaf, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  loginBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sheetContainer: { flex: 1, backgroundColor: Colors.background },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: 18, fontFamily: "DMSans_600SemiBold", color: Colors.text },
  detailHeader: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 20,
    alignItems: "center", marginBottom: 20, gap: 6,
  },
  detailPoints: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  detailPointsText: { fontSize: 24, fontFamily: "DMSans_700Bold", color: Colors.leaf },
  detailStore: { fontSize: 16, fontFamily: "DMSans_600SemiBold", color: Colors.text },
  detailMetaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailDate: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  detailProvince: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailProvinceText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  itemsTitle: { fontSize: 16, fontFamily: "DMSans_700Bold", color: Colors.text, marginBottom: 12 },
  barcodeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8,
  },
  barcodeLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  barcodeEmoji: { fontSize: 24 },
  barcodeName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  barcodeMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  barcodeCat: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  barcodeReason: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, flex: 1 },
  barcodeRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  barcodePts: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.leaf },
  ecoBadge: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  ecoBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  noProductsMsg: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card,
    borderRadius: 12, padding: 16,
  },
  noProductsText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  itemsTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemsHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 16 },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  itemEmoji: { fontSize: 20 },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  itemCat: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  itemPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.leaf },
  editBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center", marginLeft: 2,
  },
  correctionOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  correctionSheet: {
    backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  correctionTitle: { fontSize: 18, fontFamily: "DMSans_700Bold", color: Colors.text },
  correctionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: -4 },
  correctionInput: {
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, marginTop: 4,
  },
  correctionActions: { flexDirection: "row", gap: 12, marginTop: 4, paddingBottom: 8 },
  correctionCancel: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  correctionCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  correctionConfirm: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.leaf, borderRadius: 14, paddingVertical: 14,
  },
  correctionConfirmText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  imageSection: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 12,
    marginBottom: 16, gap: 8,
  },
  receiptImage: {
    width: "100%", height: 200, borderRadius: 12,
    backgroundColor: Colors.background,
  },
  imageExpiry: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 4,
  },
  imageExpiryText: {
    fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary,
  },
  receiptIconPending: {
    backgroundColor: "#FEF3C7",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  pendingBadgeText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.amber,
  },
  pendingInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  pendingInfoText: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.amber,
  },
  pendingBanner: {
    backgroundColor: "#FEF3C7", borderRadius: 16, padding: 16,
    marginBottom: 16, gap: 6,
    borderWidth: 1, borderColor: "#FCD34D",
  },
  pendingBannerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingBannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.amber },
  pendingBannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400E", lineHeight: 18 },
  itemRowMatched: {
    opacity: 0.65,
  },
  verifiedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  verifiedBadgeText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.leaf,
  },
  scanItemBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.leaf, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  scanItemBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff",
  },
});
