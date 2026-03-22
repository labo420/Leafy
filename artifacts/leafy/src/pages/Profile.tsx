import React, { useState, useRef, useEffect } from "react";
import { useGetProfile, useGetChallenges, useGetImpact, useGetMyBadges } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Target, Award, Trophy, Settings, Camera, Leaf, Lock, Calendar, Clock } from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { motion, AnimatePresence, useInView } from "framer-motion";

function useCountUp(target: number, inView: boolean, duration = 1200): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current || target === 0) return;
    hasAnimated.current = true;
    const start = Date.now();
    const step = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, inView, duration]);

  return val;
}

function CountUpValue({ value, decimals, unit, inView }: { value: number; decimals: number; unit: string; inView: boolean }) {
  const anim = useCountUp(value, inView);
  const display = decimals > 0 ? anim.toFixed(decimals) : Math.round(anim).toString();
  return (
    <p className="text-xl font-bold text-foreground">
      {display}
      {unit && <span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>}
    </p>
  );
}

function ImpactSection({ imp }: { imp: { co2SavedKg: number; waterSavedLiters: number; plasticAvoidedKg: number; greenProductsCount: number; receiptsScanned: number } }) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.3 });

  const metrics = [
    { emoji: "🌍", value: imp.co2SavedKg, unit: "kg", label: "CO₂ risparmiata", equiv: `≈ ${Math.round(imp.co2SavedKg * 5)} km in auto`, bg: "bg-blue-50", iconBg: "bg-blue-100", decimals: 1 },
    { emoji: "💧", value: imp.waterSavedLiters, unit: "L", label: "Acqua salvata", equiv: `≈ ${Math.round(imp.waterSavedLiters / 40)} docce`, bg: "bg-teal-50", iconBg: "bg-teal-100", decimals: 0 },
    { emoji: "♻️", value: imp.plasticAvoidedKg, unit: "kg", label: "Plastica evitata", equiv: `≈ ${Math.round(imp.plasticAvoidedKg / 0.025)} bottiglie`, bg: "bg-orange-50", iconBg: "bg-orange-100", decimals: 2 },
    { emoji: "🌿", value: imp.greenProductsCount, unit: "", label: "Prodotti green", equiv: `${imp.greenProductsCount} articoli eco`, bg: "bg-green-50", iconBg: "bg-green-100", decimals: 0 },
    { emoji: "🧾", value: imp.receiptsScanned, unit: "", label: "Scontrini", equiv: `${imp.receiptsScanned} analizzati`, bg: "bg-purple-50", iconBg: "bg-purple-100", decimals: 0 },
  ];

  return (
    <section ref={sectionRef} className="space-y-3">
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <Leaf className="w-5 h-5 text-primary" />
        Il tuo impatto verde
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
        {metrics.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className={`min-w-[120px] ${m.bg} rounded-2xl p-3.5 flex flex-col items-center text-center gap-1 shrink-0`}
          >
            <div className={`w-9 h-9 rounded-full ${m.iconBg} flex items-center justify-center text-lg mb-0.5`}>{m.emoji}</div>
            <CountUpValue value={m.value} decimals={m.decimals} unit={m.unit} inView={inView} />
            <p className="text-[10px] font-semibold text-muted-foreground">{m.label}</p>
            {m.equiv && <p className="text-[9px] text-muted-foreground/60">{m.equiv}</p>}
          </motion.div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70 mt-2 px-1 text-left">
        Stime indicative basate sulla categoria del prodotto, non dati precisi per singolo articolo.
      </p>
    </section>
  );
}

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
  const search = useSearch();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("traguardi");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    if (tab === "sfide") setBadgeTab("sfide");
    else if (tab === "traguardi") setBadgeTab("traguardi");
  }, [search]);

  const p = profile || {
    id: 1, username: "GuestUser", email: "guest@leafy.app", totalPoints: 1250,
    drops: 1250, leaBalance: 12,
    level: "Ramoscello", levelProgress: 65, nextLevelPoints: 2000, streak: 5, badgesCount: 12,
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

            <div className="flex gap-3 mt-4 w-full">
              <div className="flex-1 bg-primary/5 rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <img src={`${import.meta.env.BASE_URL}images/drop-xp.png`} alt="drops" style={{ width: 18, height: 18 }} />
                </div>
                <p className="text-xl font-bold text-foreground">{(p.drops ?? p.totalPoints).toLocaleString("it-IT")}</p>
              </div>
              <div className="flex-1 bg-green-50 rounded-2xl p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">$LEA</p>
                <p className="text-xl font-bold text-green-700">{Math.floor(p.leaBalance ?? 0)}€</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ImpactSection imp={imp} />

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
                className="space-y-2.5"
              >
                {lifetimeBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-2xl p-4 flex items-center gap-3 transition-shadow ${
                      badge.isUnlocked
                        ? "bg-card border border-border/50 shadow-sm hover:shadow-md"
                        : "bg-muted/20 border border-dashed border-border/40 opacity-70"
                    }`}
                  >
                    <div className={`w-13 h-13 min-w-[52px] min-h-[52px] rounded-full flex items-center justify-center text-2xl ${
                      badge.isUnlocked ? "bg-primary/10" : "bg-muted/50 blur-[2px]"
                    }`}>
                      {badge.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight mb-0.5 truncate">{badge.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{badge.category}</p>

                      {badge.isUnlocked ? (
                        <div className="flex items-center gap-1 text-[10px] text-primary">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>Sbloccato il {formatDate(badge.unlockedAt)}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Lock className="w-3 h-3 shrink-0" />
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
                  </div>
                ))}

                {lifetimeBadges.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
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
                    <div className="space-y-2.5">
                      {activeTemporal.map((badge, i) => (
                        <div
                          key={`${badge.id}-${badge.periodKey}-${i}`}
                          className={`rounded-2xl p-4 flex items-center gap-3 transition-shadow ${
                            badge.isUnlocked
                              ? "bg-card border border-primary/20 shadow-sm ring-1 ring-primary/10"
                              : "bg-card border border-border/50 shadow-sm"
                          }`}
                        >
                          <div className={`min-w-[52px] min-h-[52px] rounded-full flex items-center justify-center text-2xl ${
                            badge.isUnlocked ? "bg-primary/10" : "bg-accent/10"
                          }`}>
                            {badge.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-tight mb-0.5 truncate">{badge.name}</p>
                            <Badge variant="secondary" className="text-[8px] px-1.5 py-0 mb-1.5">
                              {periodLabel(badge.badgeType)}
                            </Badge>

                            {badge.isUnlocked ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[10px] text-primary">
                                  <span>Completata!</span>
                                </div>
                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                  <Calendar className="w-2.5 h-2.5 shrink-0" />
                                  <span>{formatDate(badge.unlockedAt)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
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
                    <div className="space-y-2">
                      {archivedTemporal.map((badge, i) => (
                        <div
                          key={`${badge.id}-${badge.periodKey}-${i}`}
                          className={`rounded-xl p-3 flex items-center gap-3 ${
                            badge.isUnlocked
                              ? "bg-muted/30 border border-border/30"
                              : "bg-muted/15 border border-dashed border-border/20 opacity-50"
                          }`}
                        >
                          <div className={`min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-lg grayscale ${
                            badge.isUnlocked ? "opacity-70" : "opacity-30"
                          }`}>
                            {badge.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs leading-tight text-muted-foreground truncate">{badge.name}</p>
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5">{formatPeriod(badge.periodKey, badge.badgeType)}</p>
                            {badge.isUnlocked && badge.unlockedAt && (
                              <p className="text-[8px] text-muted-foreground/50 mt-0.5">{formatDate(badge.unlockedAt)}</p>
                            )}
                          </div>
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
