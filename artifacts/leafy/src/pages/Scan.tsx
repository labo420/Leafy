import React, { useState, useRef } from "react";
import { useScanReceipt, useGetProfile, getGetProfileQueryKey, useGetAcceptedStores, useBarcodePreview } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeafAnimation } from "@/components/shared/LeafAnimation";
import { Camera, CheckCircle2, ArrowRight, ScanLine, ImageIcon, Sparkles, ChevronDown, Store, ShoppingCart, Search, X, Leaf, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type ShoppingItem = {
  barcode: string;
  productName: string;
  ecoScore: string | null;
  pointsEstimate: number;
  found: boolean;
};

const ECO_SCORE_COLOR: Record<string, string> = {
  A: "text-green-600 bg-green-50",
  B: "text-lime-600 bg-lime-50",
  C: "text-yellow-600 bg-yellow-50",
  D: "text-orange-600 bg-orange-50",
  E: "text-red-600 bg-red-50",
};

export default function Scan() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [showCelebration, setShowCelebration] = useState(false);

  const [storesOpen, setStoresOpen] = useState(false);
  const { data: profile } = useGetProfile();
  const { data: acceptedStores } = useGetAcceptedStores();
  const hasActiveSession = !!(profile as any)?.activeBarcodeSession;

  // Shopping mode state
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const barcodePreviewMutation = useBarcodePreview({
    mutation: {
      onSuccess: (result, variables) => {
        const newItem: ShoppingItem = {
          barcode: variables.data.barcode,
          productName: result.productName,
          ecoScore: result.ecoScore,
          pointsEstimate: result.pointsEstimate,
          found: result.found,
        };
        setShoppingList((prev) => {
          const exists = prev.findIndex((i) => i.barcode === newItem.barcode);
          if (exists >= 0) {
            const copy = [...prev];
            copy[exists] = newItem;
            return copy;
          }
          return [newItem, ...prev];
        });
        setBarcodeInput("");
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      },
      onError: () => {
        toast.error("Prodotto non trovato. Riprova con un altro barcode.");
      },
    },
  });

  const handleBarcodeLookup = () => {
    const code = barcodeInput.trim();
    if (!code) return;
    barcodePreviewMutation.mutate({ data: { barcode: code } });
  };

  const removeShoppingItem = (barcode: string) => {
    setShoppingList((prev) => prev.filter((i) => i.barcode !== barcode));
  };

  const totalEstimate = shoppingList.reduce((sum, i) => sum + i.pointsEstimate, 0);

  const scanMutation = useScanReceipt({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setShowCelebration(true);

        if (result.leveledUp && result.newLevel) {
          toast.success(`🎉 Livello aumentato! Sei ora ${result.newLevel}!`, {
            description: `Continua così per sbloccare premi esclusivi.`,
            duration: 6000,
          });
        } else if (result.pointsEarned > 0) {
          const found = (result.greenItemsFound ?? []).length;
          toast.success(`🌿 +${result.pointsEarned} punti guadagnati!`, {
            description: `${found} prodott${found === 1 ? "o green" : "i green"} rilevat${found === 1 ? "o" : "i"}.`,
          });
        } else {
          toast("Scontrino analizzato!", {
            description: "Nessun prodotto sostenibile trovato stavolta. Prossima volta potresti guadagnare punti!",
            icon: "📋",
          });
        }

        if (result.challengesUpdated && result.challengesUpdated.length > 0) {
          setTimeout(() => {
            result.challengesUpdated.forEach((name) => {
              toast.success(`🏆 Sfida completata: ${name}!`, { description: "Hai guadagnato punti bonus!", duration: 5000 });
            });
          }, 1200);
        }

        if (result.badges && result.badges.length > 0) {
          setTimeout(() => {
            result.badges.forEach((b) => {
              toast.success(`${b.emoji} Badge sbloccato: ${b.name}!`, { description: "Nuovo traguardo raggiunto!", duration: 5000 });
            });
          }, 2400);
        }
      },
      onError: (err) => {
        const serverMsg = (err as { data?: { error?: string } })?.data?.error;
        if (serverMsg) {
          toast.error(serverMsg);
        } else {
          toast.error("Errore durante l'analisi", {
            description: "Riprova con una foto più nitida e ben illuminata.",
          });
        }
      }
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  const handleScan = () => {
    if (!preview) return;
    const base64 = preview.split(',')[1] || preview;
    scanMutation.mutate({ data: { imageBase64: base64 } });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setShowCelebration(false);
    scanMutation.reset();
  };

  if (scanMutation.isSuccess && scanMutation.data && showCelebration) {
    const result = scanMutation.data;
    return (
      <div className="p-6 pt-12 flex flex-col items-center text-center min-h-[80vh] justify-center relative">
        <LeafAnimation isActive={showCelebration} />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center mb-6 shadow-xl shadow-primary/30"
        >
          <CheckCircle2 className="w-12 h-12" />
        </motion.div>

        <h2 className="font-display font-bold text-3xl mb-2 text-foreground">Bravissimo!</h2>
        <p className="text-muted-foreground mb-8">Ecco cosa hai guadagnato su questa spesa.</p>

        <Card className="w-full mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-primary mb-1">PUNTI GUADAGNATI</p>
            <p className="font-display text-5xl font-bold text-primary mb-6">+{result.pointsEarned}</p>

            <div className="space-y-3 text-left">
              {(result.greenItemsFound ?? []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-card p-3 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.emoji}</span>
                    <div>
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                  <span className="font-bold text-primary">+{item.points}</span>
                </div>
              ))}
              {(result.greenItemsFound ?? []).length === 0 && (
                <p className="text-center text-sm text-muted-foreground italic py-2">
                  Nessun prodotto green rilevato stavolta. Ritenta al prossimo acquisto!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={reset} className="w-full gap-2 rounded-xl" size="lg">
          Analizza un altro scontrino <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 pt-10 h-full flex flex-col">
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground mb-0.5">Scansiona</h1>
            <p className="text-muted-foreground text-sm">
              {hasActiveSession
                ? "Sessione attiva — scansiona i barcode dei prodotti."
                : "Analizza la tua spesa e scopri quanti punti hai guadagnato."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-accent/15 text-accent-foreground px-3 py-1.5 rounded-full text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            Fino a +150 pt
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-4">
        {!preview ? (
          <>
            {/* Hero scan zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 relative rounded-3xl overflow-hidden cursor-pointer min-h-[300px]"
            >
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10" />

              {/* Subtle grid texture */}
              <div
                className="absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage: "radial-gradient(circle, hsl(153 40% 30%) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />


              {/* Center camera button */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 18 }}
                  className="flex flex-col items-center justify-center w-44 h-44 rounded-full bg-gradient-to-br from-primary to-[#23533e] shadow-2xl shadow-primary/60"
                >
                  <Camera className="w-14 h-14 text-white mb-1" />
                  <span className="text-white/90 text-xs font-semibold tracking-wide">
                    {hasActiveSession ? "SCANSIONA" : "FOTOGRAFA"}
                  </span>
                </motion.div>
                {!hasActiveSession && (
                  <p className="text-xs text-muted-foreground">oppure carica dalla galleria</p>
                )}
                <p className="text-[11px] text-muted-foreground/70 mt-2 max-w-[220px] text-center leading-tight">
                  Fotografa lo scontrino per intero — totale e data devono essere visibili
                </p>
              </div>
            </div>

            {/* Two action strips */}
            {!hasActiveSession && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-card border border-border/70 rounded-2xl py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-primary" />
                Galleria
              </button>
            )}
          </>
        ) : (
          <div className="relative w-full h-80 rounded-3xl overflow-hidden shadow-lg border border-border/50 bg-black/5">
            <img src={preview} alt="Receipt preview" className="w-full h-full object-contain opacity-90" />

            {scanMutation.isPending && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <ScanLine className="w-16 h-16 text-primary animate-pulse mb-4" />
                <p className="font-bold text-lg text-primary animate-pulse">Analisi in corso...</p>
                <p className="text-sm text-muted-foreground mt-2">Ricerca prodotti sostenibili...</p>
              </div>
            )}

            {!scanMutation.isPending && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-4 right-4 rounded-full shadow-md"
                onClick={(e) => { e.stopPropagation(); setPreview(null); setFile(null); }}
              >
                Cambia foto
              </Button>
            )}
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <Button
          className="w-full text-lg h-14 rounded-2xl shadow-lg shadow-primary/30 bg-gradient-to-br from-primary to-[#23533e] hover:shadow-primary/50 transition-shadow"
          disabled={scanMutation.isPending}
          onClick={() => {
            if (!preview) {
              fileInputRef.current?.click();
              return;
            }
            handleScan();
          }}
          isLoading={scanMutation.isPending}
        >
          {scanMutation.isPending ? "Analizzando..." : "Analizza la tua spesa"}
        </Button>

        {/* ─── Modalità Spesa ─── */}
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
          <button
            onClick={() => {
              setShoppingOpen((v) => !v);
              if (!shoppingOpen) setTimeout(() => barcodeInputRef.current?.focus(), 200);
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-primary" />
              </span>
              <span>
                Modalità Spesa
                {shoppingList.length > 0 && (
                  <span className="ml-2 text-xs font-semibold text-primary">
                    ~{totalEstimate} pt stimati
                  </span>
                )}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${shoppingOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {shoppingOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                  <p className="text-xs text-muted-foreground leading-snug">
                    Digita un codice a barre per vedere la stima dei punti prima di fare la spesa.
                  </p>

                  {/* Barcode input */}
                  <div className="flex gap-2">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="Codice a barre (es. 3017620422003)"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
                      className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                    />
                    <Button
                      size="sm"
                      onClick={handleBarcodeLookup}
                      disabled={!barcodeInput.trim() || barcodePreviewMutation.isPending}
                      className="rounded-xl px-4 shrink-0"
                      isLoading={barcodePreviewMutation.isPending}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Product list */}
                  {shoppingList.length > 0 && (
                    <div className="space-y-2">
                      {shoppingList.map((item) => (
                        <div
                          key={item.barcode}
                          className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2.5"
                        >
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Leaf className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.productName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.ecoScore ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${ECO_SCORE_COLOR[item.ecoScore.toUpperCase()] ?? "text-muted-foreground bg-muted"}`}>
                                  Eco-Score {item.ecoScore.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Score non disponibile</span>
                              )}
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-xs font-semibold text-primary">
                                {item.pointsEstimate > 0 ? `~+${item.pointsEstimate} pt` : "0 pt"}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeShoppingItem(item.barcode)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Total estimate */}
                      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                        <span className="text-sm font-semibold text-foreground">Stima totale</span>
                        <span className="text-sm font-bold text-primary">~+{totalEstimate} pt</span>
                      </div>

                      <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>I punti reali dipendono dallo scontrino e dalla verifica d'acquisto.</span>
                      </div>

                      <button
                        onClick={() => setShoppingList([])}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        Svuota lista
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {acceptedStores && (
          <div className="mt-2">
            <button
              onClick={() => setStoresOpen(!storesOpen)}
              className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                Negozi accettati
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${storesOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {storesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-4 text-xs">
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Supermercati</p>
                      <p className="text-muted-foreground leading-relaxed">{acceptedStores.standard.join(", ")}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Bio / Naturale</p>
                      <p className="text-muted-foreground leading-relaxed">{acceptedStores.bio.join(", ")}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Discount</p>
                      <p className="text-muted-foreground leading-relaxed">{acceptedStores.discount.join(", ")}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
