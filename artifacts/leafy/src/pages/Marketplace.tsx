import React, { useState } from "react";
import { useGetVouchers, useGetProfile, useRedeemVoucher, getGetVouchersQueryKey, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, Tag, Check, TicketPercent, Zap } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState<"vouchers" | "my_codes">("vouchers");
  const [selectedVoucher, setSelectedVoucher] = useState<number | null>(null);
  const [codeModal, setCodeModal] = useState<{title: string, code: string} | null>(null);

  const queryClient = useQueryClient();
  const { data: profile } = useGetProfile();
  const { data: vouchers, isLoading } = useGetVouchers();

  const redeemMutation = useRedeemVoucher({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVouchersQueryKey() });
        toast.success("Premio riscattato con successo!");
        const voucher = list.find(v => v.id === selectedVoucher);
        if (voucher) {
          setCodeModal({ title: voucher.title, code: data.code });
        }
        setSelectedVoucher(null);
      },
      onError: (error) => {
        toast.error("Errore: " + (error.data?.error || "Punti insufficienti"));
        setSelectedVoucher(null);
      }
    }
  });

  const list = vouchers && vouchers.length > 0 ? vouchers : [
    { id: 1, title: "Sconto 10% Spesa", description: "Valido su tutti i prodotti biologici", brandName: "NaturaSì", category: "Spesa", pointsCost: 1000, discount: "10%", isAvailable: true },
    { id: 2, title: "Borraccia Termica", description: "Borraccia in acciaio inox 500ml", brandName: "EcoLife", category: "Lifestyle", pointsCost: 2500, discount: "Free", isAvailable: true },
    { id: 3, title: "Sconto 5€ Cosmesi", description: "Cosmetici cruelty-free e vegani", brandName: "GreenBeauty", category: "Beauty", pointsCost: 500, discount: "5€", isAvailable: true },
  ];

  const userPoints = profile?.totalPoints || 1250;

  const handleRedeem = (id: number) => {
    setSelectedVoucher(id);
    redeemMutation.mutate({ id });
  };

  const getProgressPercent = (cost: number) => Math.min((userPoints / cost) * 100, 100);
  const isAlmostThere = (cost: number) => userPoints < cost && getProgressPercent(cost) >= 80;

  return (
    <div className="p-6 pt-10 min-h-full pb-24">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-foreground mb-1">Premi</h1>
          <p className="text-muted-foreground">Usa i tuoi punti green.</p>
        </div>
        <div className="text-right bg-primary/10 px-4 py-2 rounded-2xl">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Il tuo saldo</p>
          <p className="font-display font-bold text-xl text-primary flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            {new Intl.NumberFormat("it-IT").format(userPoints)}
          </p>
        </div>
      </header>

      <div className="flex bg-muted/50 p-1 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab("vouchers")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "vouchers" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
        >
          Catalogo
        </button>
        <button
          onClick={() => setActiveTab("my_codes")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "my_codes" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
        >
          I Miei Buoni
        </button>
      </div>

      {activeTab === "vouchers" && (
        <div className="grid grid-cols-1 gap-5">
          {list.map((v) => (
            <Card key={v.id} className={`overflow-hidden border-transparent shadow-md hover:shadow-lg transition-shadow ${isAlmostThere(v.pointsCost) ? "ring-2 ring-accent/40" : ""}`}>
              <div className="bg-gradient-to-r from-accent/20 to-transparent p-4 flex justify-between items-center border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-accent/30 text-accent-foreground">
                    <Tag className="w-3 h-3 mr-1" /> {v.category}
                  </Badge>
                  {isAlmostThere(v.pointsCost) && (
                    <Badge className="bg-accent text-accent-foreground gap-1 animate-pulse">
                      <Zap className="w-3 h-3" /> Quasi!
                    </Badge>
                  )}
                </div>
                <span className="font-display font-bold text-2xl text-accent-foreground">{v.discount}</span>
              </div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-foreground leading-tight mb-1">{v.title}</h3>
                    <p className="text-sm text-muted-foreground">{v.brandName}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{v.description}</p>

                {/* Progress bar toward redemption */}
                {userPoints < v.pointsCost && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
                      <span>{new Intl.NumberFormat("it-IT").format(userPoints)} pt</span>
                      <span>{new Intl.NumberFormat("it-IT").format(v.pointsCost)} pt</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isAlmostThere(v.pointsCost) ? "bg-accent" : "bg-primary/40"}`}
                        style={{ width: `${getProgressPercent(v.pointsCost)}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => handleRedeem(v.id)}
                  disabled={userPoints < v.pointsCost || !v.isAvailable || redeemMutation.isPending}
                  className="w-full justify-between px-6"
                  variant={userPoints >= v.pointsCost ? "default" : "secondary"}
                >
                  <span>{userPoints >= v.pointsCost ? "Riscatta ora" : "Punti insufficienti"}</span>
                  <span className="flex items-center gap-1 font-bold bg-black/10 px-2 py-1 rounded-md">
                    <Sparkles className="w-4 h-4" /> {v.pointsCost}
                  </span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "my_codes" && (
        <div className="text-center py-12 bg-card rounded-3xl border border-border/50 shadow-sm">
          <TicketPercent className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="font-bold text-lg text-foreground">Nessun buono attivo</h3>
          <p className="text-muted-foreground mt-1 text-sm px-6">Riscatta i tuoi punti per ottenere sconti e premi esclusivi.</p>
        </div>
      )}

      {/* Code Modal */}
      <AnimatePresence>
        {codeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-accent" />

              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 mt-2">
                <Check className="w-8 h-8" strokeWidth={3} />
              </div>

              <h3 className="font-display font-bold text-2xl mb-1 text-foreground">Premio Riscattato!</h3>
              <p className="text-muted-foreground mb-6 text-sm">{codeModal.title}</p>

              <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Il tuo codice segreto</p>
                <p className="font-mono font-bold text-3xl tracking-widest text-foreground select-all">
                  {codeModal.code}
                </p>
              </div>

              <Button onClick={() => setCodeModal(null)} className="w-full">
                Chiudi e usa il buono
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
