import React, { useState, useRef } from "react";
import { useScanReceipt, useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeafAnimation } from "@/components/shared/LeafAnimation";
import { Camera, CheckCircle2, ArrowRight, ScanLine, ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const FLOATING_ITEMS = [
  { emoji: "🌿", label: "Pasta Bio", pts: "+12 pt", x: "8%",  y: "12%" },
  { emoji: "♻️", label: "Detersivo Eco", pts: "+8 pt",  x: "58%", y: "8%"  },
  { emoji: "🥦", label: "Verdure Km0", pts: "+15 pt", x: "5%",  y: "58%" },
  { emoji: "🫒", label: "Olio DOP",    pts: "+10 pt", x: "62%", y: "62%" },
  { emoji: "🌱", label: "Yogurt Vegano", pts: "+8 pt", x: "30%", y: "76%" },
];

export default function Scan() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [showCelebration, setShowCelebration] = useState(false);

  const { data: profile } = useGetProfile();
  const hasActiveSession = !!(profile as any)?.activeBarcodeSession;

  const scanMutation = useScanReceipt({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setShowCelebration(true);

        const r = result as typeof result & { leveledUp?: boolean; newLevel?: string; usingRealOcr?: boolean };

        if (r.leveledUp && r.newLevel) {
          toast.success(`🎉 Livello aumentato! Sei ora ${r.newLevel}!`, {
            description: `Complimenti! Continua così per sbloccare premi esclusivi.`,
            duration: 6000,
          });
        } else if (r.pointsEarned > 0) {
          toast.success(`🌿 +${r.pointsEarned} punti guadagnati!`, {
            description: `${r.greenItemsFound.length} prodott${r.greenItemsFound.length === 1 ? "o green" : "i green"} rilevat${r.greenItemsFound.length === 1 ? "o" : "i"}.`,
          });
        } else {
          toast("Ops, la foto è un po' sfocata, riproviamo?", {
            description: "Assicurati che lo scontrino sia ben illuminato e leggibile.",
            icon: "📋",
          });
        }

        if (r.challengesUpdated && r.challengesUpdated.length > 0) {
          setTimeout(() => {
            r.challengesUpdated.forEach((name) => {
              toast.success(`🏆 Sfida completata: ${name}!`, { description: "Hai guadagnato punti bonus!", duration: 5000 });
            });
          }, 1200);
        }

        if (r.badges && r.badges.length > 0) {
          setTimeout(() => {
            r.badges.forEach((b) => {
              toast.success(`${b.emoji} Badge sbloccato: ${b.name}!`, { description: "Nuovo traguardo raggiunto!", duration: 5000 });
            });
          }, 2400);
        }
      },
      onError: () => {
        toast.error("Ops, la foto è un po' sfocata, riproviamo?", {
          description: "Assicurati che l'immagine sia nitida e ben illuminata.",
        });
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
              {result.greenItemsFound.map((item, idx) => (
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
              {result.greenItemsFound.length === 0 && (
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

              {/* Outer glow ring */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.25, 0.15] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-56 h-56 rounded-full border-2 border-primary/30"
                />
                <motion.div
                  animate={{ scale: [1, 1.05, 1], opacity: [0.08, 0.15, 0.08] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute w-72 h-72 rounded-full border border-primary/20"
                />
              </div>

              {/* Floating product chips */}
              {FLOATING_ITEMS.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: [0, -6, 0] }}
                  transition={{
                    opacity: { delay: 0.3 + i * 0.15, duration: 0.4 },
                    y: { delay: i * 0.4, duration: 2.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="absolute flex items-center gap-1.5 bg-card/85 backdrop-blur-sm rounded-2xl px-2.5 py-1.5 shadow-md border border-border/50 pointer-events-none"
                  style={{ left: item.x, top: item.y }}
                >
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-xs font-medium text-foreground/75 whitespace-nowrap">{item.label}</span>
                  <span className="text-xs font-bold text-primary whitespace-nowrap">{item.pts}</span>
                </motion.div>
              ))}

              {/* Center camera button */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="w-24 h-24 rounded-full bg-primary shadow-2xl shadow-primary/40 flex items-center justify-center"
                >
                  <Camera className="w-11 h-11 text-white" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {hasActiveSession ? "Scansiona il barcode" : "Tocca per fotografare"}
                  </p>
                  {!hasActiveSession && (
                    <p className="text-xs text-muted-foreground mt-0.5">oppure carica dalla galleria</p>
                  )}
                </div>
              </div>
            </div>

            {/* Two action strips */}
            {!hasActiveSession && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-card border border-border/70 rounded-2xl py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors"
                >
                  <Camera className="w-4 h-4 text-primary" />
                  Fotocamera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-card border border-border/70 rounded-2xl py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Galleria
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 relative rounded-3xl overflow-hidden shadow-lg border border-border/50 bg-black/5">
            <img src={preview} alt="Receipt preview" className="w-full h-full object-cover opacity-90" />

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
          className="w-full text-lg h-14 rounded-2xl shadow-xl shadow-primary/20"
          disabled={!preview || scanMutation.isPending}
          onClick={handleScan}
          isLoading={scanMutation.isPending}
        >
          {scanMutation.isPending ? "Analizzando..." : "Analizza la tua spesa"}
        </Button>
      </div>
    </div>
  );
}
