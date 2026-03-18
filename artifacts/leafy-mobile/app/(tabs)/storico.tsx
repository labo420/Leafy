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
import { getProductEmoji } from "@/constants/emojis";
import { apiFetch, apiBase } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { router, useLocalSearchParams } from "expo-router";

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
  const { theme } = useTheme();
  if (!score) return null;
  const letter = score.toLowerCase();
  const bg = ECO_COLORS[letter] ?? theme.textSecondary;
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
  const { theme } = useTheme();
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

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/receipts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      onClose();
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile cancellare lo scontrino. Riprova.");
    },
  });

  const handleDeleteReceipt = () => {
    Alert.alert(
      "Cancella scontrino",
      "Sei sicuro? Perderai i punti guadagnati finora.",
      [
        { text: "Annulla", onPress: () => {}, style: "cancel" },
        {
          text: "Cancella",
          onPress: () => deleteMutation.mutate(),
          style: "destructive",
        },
      ]
    );
  };

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
      <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24, backgroundColor: theme.background }]}>
        <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
        <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Dettagli scontrino</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={24} color={theme.textSecondary} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.leaf} style={{ marginTop: 40 }} />
        ) : data ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>

            {data.isPending && (
              <View style={styles.pendingBanner}>
                <View style={styles.pendingBannerTop}>
                  <Feather name="clock" size={18} color={theme.amber} />
                  <Text style={[styles.pendingBannerTitle, { color: theme.amber }]}>Verifica in sospeso</Text>
                </View>
                <Text style={styles.pendingBannerSub}>
                  Hai ancora {data.remainingHours} ore per scansionare i barcode dei prodotti green
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.deletePendingBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleDeleteReceipt}
                  disabled={deleteMutation.isPending}
                >
                  <Feather name="trash-2" size={14} color="#fff" />
                  <Text style={styles.deletePendingBtnText}>
                    {deleteMutation.isPending ? "Annullamento..." : "Cancella scontrino"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={[styles.detailHeader, { backgroundColor: theme.card }]}>
              <View style={styles.detailPoints}>
                <MaterialCommunityIcons name="leaf" size={20} color={theme.leaf} />
                <Text style={[styles.detailPointsText, { color: theme.leaf }]}>+{data.pointsEarned} punti</Text>
              </View>
              {data.storeName && <Text style={[styles.detailStore, { color: theme.text }]}>{data.storeName}</Text>}
              <View style={styles.detailMetaRow}>
                {data.scannedAt && <Text style={[styles.detailDate, { color: theme.textSecondary }]}>{formatDate(data.scannedAt)}</Text>}
                {data.province && (
                  <View style={styles.detailProvince}>
                    <Feather name="map-pin" size={12} color={theme.textSecondary} />
                    <Text style={[styles.detailProvinceText, { color: theme.textSecondary }]}>{data.province}</Text>
                  </View>
                )}
              </View>
            </View>

            {data.hasImage && imageData && (
              <View style={[styles.imageSection, { backgroundColor: theme.card }]}>
                <Image
                  source={{ uri: imageData }}
                  style={[styles.receiptImage, { backgroundColor: theme.background }]}
                  resizeMode="contain"
                />
                {data.imageExpiresAt && (
                  <View style={styles.imageExpiry}>
                    <Feather name="clock" size={12} color={theme.textSecondary} />
                    <Text style={[styles.imageExpiryText, { color: theme.textSecondary }]}>
                      Foto disponibile fino al {formatDate(data.imageExpiresAt)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {data.barcodeScans && data.barcodeScans.length > 0 && (
              <>
                <Text style={[styles.itemsTitle, { color: theme.text }]}>
                  Prodotti scansionati ({data.barcodeScans.length})
                </Text>
                {data.barcodeScans.map((scan) => (
                  <View key={scan.id} style={[styles.barcodeRow, { backgroundColor: theme.card }]}>
                    <View style={styles.barcodeLeft}>
                      <Text style={styles.categoryEmoji}>{getProductEmoji(scan.productName, scan.category, scan.emoji)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.barcodeName, { color: theme.text }]} numberOfLines={1}>
                          {scan.productName}
                        </Text>
                        <View style={styles.barcodeMeta}>
                          <Text style={[styles.barcodeCat, { color: theme.textSecondary }]}>{scan.category}</Text>
                          {scan.reasoning ? (
                            <Text style={[styles.barcodeReason, { color: theme.textMuted }]} numberOfLines={1}>
                              {scan.reasoning}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <View style={styles.barcodeRight}>
                      <EcoScoreBadge score={scan.ecoScore} />
                      <Text style={[styles.barcodePts, { color: theme.leaf }]}>+{scan.pointsEarned}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {data.greenItems && data.greenItems.length > 0 && (() => {
              const acceptedItems = data.greenItems.filter(item => item.points > 0);
              const nonAcceptedItems = data.greenItems.filter(item => item.points === 0);
              const unmatchedCount = acceptedItems.filter(i => !i.matched).length;
              return (
                <>
                  {acceptedItems.length > 0 && (
                    <>
                      <View style={styles.itemsTitleRow}>
                        <Text style={[styles.itemsTitle, { marginTop: 16, color: theme.text }]}>
                          Prodotti idonei ({acceptedItems.length})
                        </Text>
                        {!data.isPending && (
                          <View style={styles.itemsHintRow}>
                            <Feather name="edit-2" size={11} color={theme.textSecondary} />
                            <Text style={[styles.itemsHint, { color: theme.textMuted }]}>Tocca per correggere</Text>
                          </View>
                        )}
                      </View>
                      {data.isPending && unmatchedCount > 0 && (
                        <Pressable
                          style={[styles.scanAllCta, { backgroundColor: theme.leaf }]}
                          onPress={() => {
                            onClose();
                            router.push({ pathname: "/barcode-scanner", params: { receiptId: String(data.id) } });
                          }}
                        >
                          <MaterialCommunityIcons name="barcode-scan" size={16} color="#fff" />
                          <Text style={styles.scanAllCtaText}>Scansiona prodotti mancanti ({unmatchedCount})</Text>
                        </Pressable>
                      )}
                      {acceptedItems.map((item, i) => {
                        const isUnmatched = data.isPending && item.matched === false;
                        const isMatched = data.isPending && item.matched === true;
                        return (
                          <View key={i} style={[styles.itemRow, isMatched && styles.itemRowMatched, { backgroundColor: theme.card }]}>
                            <Text style={styles.categoryEmoji}>{getProductEmoji(item.name, item.category, item.emoji)}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.itemName, { color: theme.text }]}>{formatProductName(item.name)}</Text>
                              <Text style={[styles.itemCat, { color: theme.textSecondary }]}>{item.category ?? ""}</Text>
                            </View>
                            {isMatched && (
                              <View style={[styles.verifiedBadge, { backgroundColor: theme.primaryLight }]}>
                                <Feather name="check" size={12} color={theme.leaf} />
                                <Text style={[styles.verifiedBadgeText, { color: theme.leaf }]}>+{item.points} pt</Text>
                              </View>
                            )}
                            {isUnmatched && (
                              <Pressable
                                style={[styles.scanItemBtn, { backgroundColor: theme.leaf }]}
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
                                <Text style={[styles.itemPts, { color: theme.leaf }]}>+{item.points} pt</Text>
                                <Pressable
                                  style={[styles.editBtn, { backgroundColor: theme.background }]}
                                  onPress={() => openEdit(item)}
                                  hitSlop={8}
                                >
                                  <Feather name="edit-2" size={14} color={theme.textSecondary} />
                                </Pressable>
                              </>
                            )}
                          </View>
                        );
                      })}
                    </>
                  )}
                  {nonAcceptedItems.length > 0 && (
                    <>
                      <Text style={[styles.itemsTitle, { marginTop: 16, color: theme.textSecondary }]}>
                        Prodotti non idonei ({nonAcceptedItems.length})
                      </Text>
                      {nonAcceptedItems.map((item, i) => (
                        <View key={`na-${i}`} style={[styles.itemRow, styles.nonAcceptedRow, { backgroundColor: theme.card }]}>
                          <Text style={styles.categoryEmoji}>{getProductEmoji(item.name, item.category, item.emoji)}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemName, { color: theme.textSecondary }]}>{formatProductName(item.name)}</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </>
              );
            })()}

            {(!data.barcodeScans || data.barcodeScans.length === 0) &&
             (!data.greenItems || data.greenItems.length === 0) && (
              <View style={[styles.noProductsMsg, { backgroundColor: theme.card }]}>
                <Feather name="info" size={20} color={theme.textSecondary} />
                <Text style={[styles.noProductsText, { color: theme.textSecondary }]}>
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
            <View style={[styles.correctionSheet, { backgroundColor: theme.modalBackground }]}>
              <Text style={[styles.correctionTitle, { color: theme.text }]}>Correggi il nome</Text>
              <Text style={[styles.correctionSub, { color: theme.textSecondary }]}>
                Il sistema imparerà per le prossime scansioni.
              </Text>
              <TextInput
                style={[styles.correctionInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                value={correctionText}
                onChangeText={setCorrectionText}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmCorrection}
                placeholder="Nome corretto del prodotto"
                placeholderTextColor={theme.textMuted}
              />
              <View style={styles.correctionActions}>
                <Pressable
                  style={[styles.correctionCancel, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setEditingItem(null)}
                >
                  <Text style={[styles.correctionCancelText, { color: theme.textSecondary }]}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.correctionConfirm,
                    { backgroundColor: theme.leaf },
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
  const { theme } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(50).springify()}>
      <Pressable
        style={({ pressed }) => [styles.receiptCard, { backgroundColor: theme.card }, pressed && { opacity: 0.85 }]}
        onPress={onPress}
      >
        <View style={styles.receiptTop}>
          <View style={styles.receiptLeft}>
            <View style={[styles.receiptIcon, { backgroundColor: theme.primaryLight }, receipt.isPending && styles.receiptIconPending]}>
              {receipt.isPending
                ? <Feather name="clock" size={20} color={theme.amber} />
                : <Feather name="shopping-bag" size={20} color={theme.leaf} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.receiptStore, { color: theme.text }]}>
                {receipt.storeName ?? "Negozio sconosciuto"}
              </Text>
              <View style={styles.receiptMetaRow}>
                <Text style={[styles.receiptDate, { color: theme.textSecondary }]}>{formatDate(receipt.scannedAt)}</Text>
                {receipt.province && (
                  <View style={styles.provinceBadge}>
                    <Feather name="map-pin" size={10} color={theme.textSecondary} />
                    <Text style={[styles.provinceText, { color: theme.textSecondary }]}>{receipt.province}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {receipt.isPending ? (
            <View style={styles.pendingBadge}>
              <Text style={[styles.pendingBadgeText, { color: theme.amber }]}>⏳ {receipt.remainingHours}h</Text>
            </View>
          ) : (
            <View style={[styles.receiptPointsBadge, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.receiptPointsBadgeText, { color: theme.leaf }]}>+{receipt.pointsEarned} pts</Text>
            </View>
          )}
        </View>

        {receipt.isPending && receipt.pendingProductsCount > 0 && (
          <View style={[styles.pendingInfoRow, { borderTopColor: theme.border }]}>
            <MaterialCommunityIcons name="barcode-scan" size={13} color={theme.amber} />
            <Text style={[styles.pendingInfoText, { color: theme.amber }]}>
              {receipt.pendingProductsCount} prodott{receipt.pendingProductsCount === 1 ? "o" : "i"} da verificare
            </Text>
          </View>
        )}

        {!receipt.isPending && receipt.categories && receipt.categories.length > 0 && (
          <View style={[styles.catRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.catCountText, { color: theme.textSecondary }]}>{receipt.greenItemsCount} prodotti:</Text>
            {receipt.categories.map((cat, idx) => {
              const color = CATEGORY_COLORS[cat] || { bg: theme.cardAlt, text: theme.textSecondary };
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
  const { theme } = useTheme();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { openReceiptId } = useLocalSearchParams<{ openReceiptId?: string }>();

  React.useEffect(() => {
    if (openReceiptId && openReceiptId.length > 0) {
      setSelectedId(Number(openReceiptId));
      router.setParams({ openReceiptId: "" });
    }
  }, [openReceiptId]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 100 + insets.bottom;

  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["receipts"],
    queryFn: () => apiFetch("/receipts"),
    enabled: !!user,
  });

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding, backgroundColor: theme.background }]}>
        <Feather name="list" size={48} color={theme.primaryMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Accedi per vedere lo storico</Text>
        <Pressable style={[styles.loginBtn, { backgroundColor: theme.leaf }]} onPress={() => router.push("/(tabs)")}>
          <Text style={styles.loginBtnText}>Accedi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Storico</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {receipts?.length ?? 0} scontrini scansionati
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.leaf} style={{ marginTop: 40 }} />
      ) : !receipts || receipts.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={56} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessuno scontrino ancora</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Il tuo primo scontrino vale punti green!</Text>
          <Pressable style={[styles.scanBtn, { backgroundColor: theme.leaf }]} onPress={() => router.push("/(tabs)/scan")}>
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
  container: { flex: 1 },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32,
  },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 32, fontFamily: "DMSans_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  receiptCard: {
    borderRadius: 24, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  receiptTop: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12,
  },
  receiptLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  receiptIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  receiptStore: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  receiptDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  receiptMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  provinceBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  provinceText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  receiptPointsBadge: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  receiptPointsBadgeText: {
    fontSize: 15, fontFamily: "DMSans_700Bold",
  },
  catRow: {
    flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center",
    paddingTop: 12, borderTopWidth: 1,
  },
  catCountText: {
    fontSize: 11, fontFamily: "Inter_500Medium", marginRight: 2,
  },
  catBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  catText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "DMSans_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8,
  },
  scanBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  loginBtn: { marginTop: 20, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  loginBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sheetContainer: { flex: 1 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 18, fontFamily: "DMSans_600SemiBold" },
  detailHeader: {
    borderRadius: 24, padding: 20,
    alignItems: "center", marginBottom: 20, gap: 6,
  },
  detailPoints: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
    backgroundColor: "rgba(76, 175, 80, 0.12)", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
  },
  detailPointsText: { fontSize: 32, fontFamily: "DMSans_700Bold" },
  detailStore: { fontSize: 16, fontFamily: "DMSans_600SemiBold" },
  detailMetaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailProvince: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailProvinceText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  itemsTitle: { fontSize: 16, fontFamily: "DMSans_700Bold", marginBottom: 12 },
  barcodeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  barcodeLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  categoryEmoji: {
    fontSize: 18,
    width: 32,
    textAlign: "center",
  },
  barcodeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  barcodeMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  barcodeCat: { fontSize: 11, fontFamily: "Inter_500Medium" },
  barcodeReason: { fontSize: 10, fontFamily: "Inter_400Regular", flex: 1 },
  barcodeRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  barcodePts: { fontSize: 17, fontFamily: "DMSans_700Bold" },
  ecoBadge: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  ecoBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  noProductsMsg: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, padding: 16,
  },
  noProductsText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  itemsTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemsHintRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemsHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  nonAcceptedRow: {
    opacity: 0.65,
  },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemCat: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  itemPts: { fontSize: 14, fontFamily: "Inter_700Bold" },
  editBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginLeft: 2,
  },
  correctionOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  correctionSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  correctionTitle: { fontSize: 18, fontFamily: "DMSans_700Bold" },
  correctionSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -4 },
  correctionInput: {
    borderWidth: 1.5,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4,
  },
  correctionActions: { flexDirection: "row", gap: 12, marginTop: 4, paddingBottom: 8 },
  correctionCancel: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1,
  },
  correctionCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  correctionConfirm: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderRadius: 14, paddingVertical: 14,
  },
  correctionConfirmText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  imageSection: {
    borderRadius: 24, padding: 12,
    marginBottom: 16, gap: 8,
  },
  receiptImage: {
    width: "100%", height: 200, borderRadius: 12,
  },
  imageExpiry: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 4,
  },
  imageExpiryText: {
    fontSize: 11, fontFamily: "Inter_400Regular",
  },
  receiptIconPending: {
    backgroundColor: "#FEF3C7",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  pendingBadgeText: {
    fontSize: 13, fontFamily: "Inter_700Bold",
  },
  pendingInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingTop: 10, borderTopWidth: 1,
  },
  pendingInfoText: {
    fontSize: 12, fontFamily: "Inter_500Medium",
  },
  pendingBanner: {
    backgroundColor: "#FEF3C7", borderRadius: 16, padding: 16,
    marginBottom: 16, gap: 6,
    borderWidth: 1, borderColor: "#FCD34D",
  },
  pendingBannerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingBannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.amber },
  pendingBannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400E", lineHeight: 18 },
  deletePendingBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(220, 53, 69, 0.8)", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    marginTop: 4,
  },
  deletePendingBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  itemRowMatched: {
    opacity: 0.65,
  },
  verifiedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  verifiedBadgeText: {
    fontSize: 12, fontFamily: "Inter_700Bold",
  },
  scanAllCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12,
  },
  scanAllCtaText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  scanItemBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  scanItemBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff",
  },
});
