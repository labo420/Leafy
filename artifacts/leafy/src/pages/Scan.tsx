import React, { useState, useRef } from "react";
import { useScanReceipt, useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeafAnimation } from "@/components/shared/LeafAnimation";
import { Camera, CheckCircle2, ArrowRight, ScanLine, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl text-foreground mb-1">Scansiona</h1>
        <p className="text-muted-foreground text-sm">
          {hasActiveSession
            ? "Sessione attiva — scansiona i barcode dei prodotti."
            : "Analizza la tua spesa e scopri quanti punti hai guadagnato."}
        </p>
      </header>

      <div className="flex-1 flex flex-col">
        {!preview ? (
          <motion.div
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex-1 relative border-2 border-dashed border-primary/25 hover:border-primary/45 bg-gradient-to-br from-primary/5 via-background to-secondary/10 hover:from-primary/10 hover:to-secondary/15 transition-all duration-300 rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer group min-h-[300px] overflow-hidden"
          >
            {/* Decorative background rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 rounded-full border border-primary/8 absolute" />
              <div className="w-72 h-72 rounded-full border border-primary/5 absolute" />
            </div>

            {/* Camera icon — layered circles */}
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shadow-lg shadow-primary/10 group-hover:shadow-primary/25 group-hover:scale-105 transition-all duration-300">
                <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center shadow-inner">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
              </div>
            </div>

            <h3 className="font-bold text-xl mb-1.5 text-foreground">
              {hasActiveSession ? "Scansiona il barcode" : "Carica o Scatta"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-[210px] mb-5">
              {hasActiveSession
                ? "Inquadra il barcode del prodotto."
                : "Assicurati che l'immagine sia nitida e leggibile."}
            </p>

            {!hasActiveSession && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-border/60 shadow-sm text-xs font-medium text-muted-foreground">
                  <Camera className="w-3 h-3 text-primary" />
                  Fotocamera
                </div>
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-border/60 shadow-sm text-xs font-medium text-muted-foreground">
                  <ImageIcon className="w-3 h-3 text-primary" />
                  Galleria
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex-1 relative rounded-3xl overflow-hidden shadow-lg border border-border/50 bg-black/5">
            <img src={preview} alt="Receipt preview" className="w-full h-full object-cover opacity-90" />

            {scanMutation.isPending && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <ScanLine className="w-16 h-16 text-primary animate-pulse mb-4" />
                <p className="font-bold text-lg text-primary animate-pulse">Analisi in corso...</p>
                <p className="text-sm text-muted-foreground mt-2">Ricerca prodotti bio, km0...</p>
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

        <div className="mt-6">
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
    </div>
  );
}
