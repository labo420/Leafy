import React, { useState, useRef } from "react";
import { useGetProfile, useGetChallenges, useGetImpact, useGetMyBadges } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Target, Award, Trophy, Info, Settings, Camera, Wind, Droplets, Leaf, Zap, Lock, Calendar, Clock } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type BadgeTab = "traguardi" | "sfide";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPeriod(periodKey: string, badgeType: string): string {
  if (badgeType === "weekly") {
    const [year, week] = periodKey.split("-W");
    return `Settimana ${parseInt(week)} — ${year}`;
  }
  if (badgeType === "monthly") {
    const [year, month] = periodKey.split("-");
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
  const [year, quarter] = periodKey.split("-Q");
  return `Q${quarter} ${year}`;
}

function periodLabel(badgeType: string): string {
  if (badgeType === "weekly") return "Settimanale";
  if (badgeType === "monthly") return "Mensile";
  return "Stagionale";
}

export default function Profile() {
  const { data: profile, refetch } = useGetProfile();
  const { data: challenges } = useGetChallenges();
  const { data: impact } = useGetImpact();
  const { data: badgesData } = useGetMyBadges();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("traguardi");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const p = profile || {
    id: 1, username: "GuestUser", email: "guest@leafy.app", totalPoints: 1250,
    level: "Argento", levelProgress: 65, nextLevelPoints: 2000, streak: 5, badgesCount: 12,
    badges: [], profileImageUrl: undefined as string | undefined
  };

  const imp = impact || {
    co2SavedKg: 14.5, plasticAvoidedKg: 3.2, waterSavedLiters: 120, greenProductsCount: 45, receiptsScanned: 18
  };

  const ch = challenges || [
    { id: 1, title: "Senza Plastica", description: "Compra 5 prodotti plastic-free", emoji: "♻️", targetCount: 5, currentCount: 3, rewardPoints: 200, progressPercent: 60, isCompleted: false, category: "Packaging", expiresAt: "2025-02-01T00:00:00Z" },
    { id: 2, title: "Veganuary", description: "Prova 3 prodotti vegani nuovi", emoji: "🌿", targetCount: 3, currentCount: 3, rewardPoints: 300, progressPercent: 100, isCompleted: true, category: "Alimentazione", expiresAt: "2025-02-01T00:00:00Z" }
  ];

  const lifetimeBadges = badgesData?.lifetime || [];
  const temporalBadges = badgesData?.temporal || [];

  const activeTemporal = temporalBadges.filter(b => !b.isExpired);
  const archivedTemporal = temporalBadges.filter(b => b.isExpired);

  const copyReferral = () => {
    navigator.clipboard.writeText("LEAFY-" + p.username.toUpperCase());
    toast.success("Codice invito copiato!");
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Immagine troppo grande (max 2MB).");
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = evt.target?.result as string;
        const res = await fetch("/api/profile/image", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ imageData: base64 }),
        });

        if (!res.ok) throw new Error("Errore nell'upload");

        await refetch();
        toast.success("Immagine aggiornata!");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Errore nell'upload dell'immagine.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-full pb-10">
      <div className="bg-primary pt-12 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2" />

        <div className="flex justify-between items-start relative z-10">
          <h1 className="font-display font-bold text-3xl text-primary-foreground">Profilo</h1>
          <div className="flex gap-2">
            <Link href="/impostazioni">
              <button className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center text-white backdrop-blur-md hover:bg-black/20 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-6">
        <Card className="border-transparent shadow-xl overflow-visible">
          <CardContent className="p-6 flex flex-col items-center text-center overflow-visible">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-background shadow-lg overflow-hidden -mt-16 mb-4 bg-muted">
                <img
                  src={p.profileImageUrl || `${import.meta.env.BASE_URL}images/avatar.png`}
                  alt="User avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Cambia foto profilo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploadingImage}
                className="hidden"
              />
            </div>
            <h2 className="font-display font-bold text-2xl text-foreground mb-4">{p.username}</h2>

            <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="font-bold text-foreground">Livello {p.level}</span>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            Il tuo impatto verde
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card/60 backdrop-blur-sm border-transparent shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                  <Wind className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-foreground">{imp.co2SavedKg} <span className="text-sm font-medium text-muted-foreground">kg</span></p>
                <p className="text-xs text-muted-foreground">CO₂ risparmiata</p>
              </CardContent>
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-transparent shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mb-1">
                  <Droplets className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-foreground">{imp.waterSavedLiters} <span className="text-sm font-medium text-muted-foreground">L</span></p>
                <p className="text-xs text-muted-foreground">Acqua salvata</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 bg-gradient-to-br from-accent/10 to-transparent border-transparent shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Prodotti Green Acquistati</p>
                    <p className="text-2xl font-bold text-foreground">{imp.greenProductsCount}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Scontrini</p>
                  <p className="font-bold text-foreground">{imp.receiptsScanned}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="bg-gradient-to-r from-accent/20 to-transparent border-transparent">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Invita un amico</h3>
              <p className="text-xs text-muted-foreground mt-1">+500 punti per entrambi!</p>
            </div>
            <Button variant="outline" className="h-10 px-4 bg-background/80 backdrop-blur-sm border-accent/20 text-accent-foreground hover:bg-accent/10" onClick={copyReferral}>
              <Copy className="w-4 h-4 mr-2" /> Copia
            </Button>
          </CardContent>
        </Card>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Sfide Attive
            </h3>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
              Mese in corso
            </span>
          </div>

          <div className="space-y-3">
            {ch.map((challenge) => (
              <Card key={challenge.id} className={`border-border/50 ${challenge.isCompleted ? 'bg-primary/5 opacity-80' : 'bg-card'}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3 items-center">
                      <span className="text-2xl">{challenge.emoji}</span>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{challenge.title}</h4>
                        <p className="text-xs text-muted-foreground">{challenge.description}</p>
                      </div>
                    </div>
                    <Badge variant={challenge.isCompleted ? "green" : "secondary"}>
                      {challenge.isCompleted ? "Completata" : `+${challenge.rewardPoints} pts`}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Progresso</span>
                      <span>{challenge.currentCount} / {challenge.targetCount}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${challenge.progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full ${challenge.isCompleted ? 'bg-primary' : 'bg-accent'} rounded-full`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary" /> Collezione Badge
          </h3>

          <div className="flex bg-muted/50 rounded-xl p-1 mb-4">
            <button
              onClick={() => setBadgeTab("traguardi")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                badgeTab === "traguardi"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🏅 Traguardi
            </button>
            <button
              onClick={() => setBadgeTab("sfide")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                badgeTab === "sfide"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🗓️ Sfide
            </button>
          </div>

          <AnimatePresence mode="wait">
            {badgeTab === "traguardi" ? (
              <motion.div
                key="traguardi"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3"
              >
                {lifetimeBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-2xl p-4 flex flex-col items-center text-center transition-shadow ${
                      badge.isUnlocked
                        ? "bg-card border border-border/50 shadow-sm hover:shadow-md"
                        : "bg-muted/20 border border-dashed border-border/40 opacity-70"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2 ${
                      badge.isUnlocked ? "bg-primary/10" : "bg-muted/50 blur-[2px]"
                    }`}>
                      {badge.emoji}
                    </div>
                    <p className="font-semibold text-xs leading-tight mb-1">{badge.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">{badge.category}</p>
                    
                    {badge.isUnlocked ? (
                      <div className="flex items-center gap-1 text-[10px] text-primary">
                        <Calendar className="w-3 h-3" />
                        <span>Sbloccato il {formatDate(badge.unlockedAt)}</span>
                      </div>
                    ) : (
                      <div className="w-full space-y-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          <span className="truncate">{badge.unlockHint}</span>
                        </div>
                        {badge.targetCount > 1 && (
                          <div className="space-y-0.5">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (badge.currentProgress / badge.targetCount) * 100)}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-accent/60 rounded-full"
                              />
                            </div>
                            <p className="text-[9px] text-muted-foreground text-right">{badge.currentProgress}/{badge.targetCount}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {lifetimeBadges.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nessun traguardo ancora. Inizia a scansionare!</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="sfide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {activeTemporal.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Attive
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {activeTemporal.map((badge, i) => (
                        <div
                          key={`${badge.id}-${badge.periodKey}-${i}`}
                          className={`rounded-2xl p-4 flex flex-col items-center text-center transition-shadow ${
                            badge.isUnlocked
                              ? "bg-card border border-primary/20 shadow-sm ring-1 ring-primary/10"
                              : "bg-card border border-border/50 shadow-sm"
                          }`}
                        >
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2 ${
                            badge.isUnlocked ? "bg-primary/10" : "bg-accent/10"
                          }`}>
                            {badge.emoji}
                          </div>
                          <p className="font-semibold text-xs leading-tight mb-1">{badge.name}</p>
                          <Badge variant="secondary" className="text-[8px] px-1.5 py-0 mb-2">
                            {periodLabel(badge.badgeType)}
                          </Badge>
                          
                          {badge.isUnlocked ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1 text-[10px] text-primary">
                                <span>Completata!</span>
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{formatDate(badge.unlockedAt)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full space-y-1">
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (badge.currentProgress / badge.targetCount) * 100)}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  className="h-full bg-accent rounded-full"
                                />
                              </div>
                              <p className="text-[9px] text-muted-foreground text-right">{badge.currentProgress}/{badge.targetCount}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {archivedTemporal.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Archivio
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {archivedTemporal.map((badge, i) => (
                        <div
                          key={`${badge.id}-${badge.periodKey}-${i}`}
                          className={`rounded-xl p-3 flex flex-col items-center text-center ${
                            badge.isUnlocked
                              ? "bg-muted/30 border border-border/30"
                              : "bg-muted/15 border border-dashed border-border/20 opacity-50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1 grayscale ${
                            badge.isUnlocked ? "opacity-70" : "opacity-30"
                          }`}>
                            {badge.emoji}
                          </div>
                          <p className="font-medium text-[10px] leading-tight text-muted-foreground">{badge.name}</p>
                          <p className="text-[8px] text-muted-foreground/60 mt-0.5">{formatPeriod(badge.periodKey, badge.badgeType)}</p>
                          {badge.isUnlocked && badge.unlockedAt && (
                            <p className="text-[7px] text-muted-foreground/50 mt-0.5">{formatDate(badge.unlockedAt)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTemporal.length === 0 && archivedTemporal.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Le sfide a tempo appariranno qui.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
