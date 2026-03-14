import React, { useState } from "react";
import { useGetReceipts, useGetReceipt } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Receipt, CalendarDays, ShoppingBag, X, Info, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function History() {
  const { data: receipts, isLoading } = useGetReceipts();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: detail, isLoading: loadingDetail } = useGetReceipt(selectedId!, {
    query: { enabled: selectedId !== null },
  });

  const list = receipts && receipts.length > 0 ? receipts : [
    { id: 1, storeName: "NaturaSì", purchaseDate: "2025-01-15T10:30:00Z", pointsEarned: 150, greenItemsCount: 3, categories: ["Bio", "Km 0"], scannedAt: "2025-01-15T14:20:00Z" },
    { id: 2, storeName: "Supermercato Locale", purchaseDate: "2025-01-12T09:15:00Z", pointsEarned: 45, greenItemsCount: 1, categories: ["Senza Plastica"], scannedAt: "2025-01-12T10:00:00Z" },
    { id: 3, storeName: "Mercato Contadino", purchaseDate: "2025-01-08T08:00:00Z", pointsEarned: 220, greenItemsCount: 5, categories: ["Km 0", "Bio", "Vegano"], scannedAt: "2025-01-08T11:45:00Z" },
  ];

  const formatProductName = (name: string) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, "green" | "blue" | "teal" | "red" | "accent" | "default"> = {
      "Bio": "green",
      "Km 0": "blue",
      "Senza Plastica": "teal",
      "Equo Solidale": "red",
      "Vegano": "accent",
    };
    return map[cat] || "default";
  };

  const selectedItem = list.find(r => r.id === selectedId);

  return (
    <div className="p-6 pt-10 min-h-full">
      <header className="mb-8">
        <h1 className="font-display font-bold text-3xl text-foreground mb-2">Storico</h1>
        <p className="text-muted-foreground">I tuoi acquisti sostenibili nel tempo.</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="w-full h-32 bg-card rounded-3xl border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedId(item.id)}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground leading-tight">{item.storeName || "Negozio Sconosciuto"}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <CalendarDays className="w-3 h-3" />
                          {format(parseISO(item.purchaseDate || item.scannedAt), "dd MMM yyyy", { locale: it })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-sm">
                        +{item.pointsEarned} pts
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-border/50">
                    <span className="text-xs font-medium text-muted-foreground mr-1">
                      {item.greenItemsCount} prodotti:
                    </span>
                    {item.categories.map((cat, idx) => (
                      <Badge key={idx} variant={getCategoryColor(cat)} className="text-[10px]">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {list.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="font-bold text-lg text-foreground">Nessuno scontrino</h3>
              <p className="text-muted-foreground mt-1">Inizia a scansionare per guadagnare punti!</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedId !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-20 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-border/50">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground">
                    {selectedItem?.storeName || "Negozio Sconosciuto"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedItem && format(
                      parseISO(selectedItem.purchaseDate || selectedItem.scannedAt),
                      "dd MMMM yyyy", { locale: it }
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-full text-sm">
                    +{selectedItem?.pointsEarned} pts
                  </span>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-6 pb-10">
                {loadingDetail ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : detail && detail.greenItems.length > 0 ? (
                  <>
                    {/* Prodotti rilevati */}
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                        Prodotti green rilevati
                      </h3>
                      <div className="space-y-2">
                        {detail.greenItems.map((item, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.06 }}
                            className="flex items-center justify-between bg-muted/40 rounded-2xl px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{item.emoji}</span>
                              <div>
                                <p className="font-semibold text-sm text-foreground">
                                  {formatProductName(item.name)}
                                </p>
                                <Badge
                                  variant={getCategoryColor(item.category)}
                                  className="text-[10px] mt-0.5"
                                >
                                  {item.category}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-primary font-bold text-sm">
                              <Star className="w-3.5 h-3.5 fill-primary" />
                              +{item.points}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>

                    {/* Totale */}
                    <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
                      <span className="font-bold text-foreground">Totale punti</span>
                      <span className="font-display font-bold text-xl text-primary">
                        +{detail.pointsEarned}
                      </span>
                    </div>

                    {/* Spiegazione logica */}
                    <section className="bg-muted/30 rounded-2xl p-4 flex gap-3">
                      <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Come funziona l'analisi</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          I prodotti vengono classificati tramite i dati di
                          <span className="font-medium text-foreground"> Open Food Facts</span>,
                          il database aperto di prodotti alimentari. Ogni categoria assegna un punteggio diverso basato sull'impatto ambientale.
                        </p>
                      </div>
                    </section>
                  </>
                ) : detail ? (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-3 block">🌿</span>
                    <p className="font-bold text-foreground mb-1">Nessun prodotto green rilevato</p>
                    <p className="text-sm text-muted-foreground">
                      In questo scontrino non sono state trovate parole chiave sostenibili.
                    </p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
