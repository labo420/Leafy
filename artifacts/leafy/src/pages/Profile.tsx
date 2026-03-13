import React, { useState, useRef } from "react";
import { useGetProfile, useGetChallenges, useGetImpact } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Target, Award, Trophy, Info, Settings, Camera, Wind, Droplets, Leaf, Zap } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Profile() {
  const { data: profile, refetch } = useGetProfile();
  const { data: challenges } = useGetChallenges();
  const { data: impact } = useGetImpact();
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const p = profile || {
    id: 1, username: "GuestUser", email: "guest@leafy.app", totalPoints: 1250,
    level: "Argento", levelProgress: 65, nextLevelPoints: 2000, streak: 5, badgesCount: 12,
    badges: [
      { id: "1", name: "Pioniere Bio", emoji: "🌱", category: "Bio" },
      { id: "2", name: "Eroe Locale", emoji: "📍", category: "Km 0" },
      { id: "3", name: "Amico degli Oceani", emoji: "💧", category: "Acqua" }
    ]
  };

  const imp = impact || {
    co2SavedKg: 14.5, plasticAvoidedKg: 3.2, waterSavedLiters: 120, greenProductsCount: 45, receiptsScanned: 18
  };

  const ch = challenges || [
    { id: 1, title: "Senza Plastica", description: "Compra 5 prodotti plastic-free", emoji: "♻️", targetCount: 5, currentCount: 3, rewardPoints: 200, progressPercent: 60, isCompleted: false, category: "Packaging", expiresAt: "2025-02-01T00:00:00Z" },
    { id: 2, title: "Veganuary", description: "Prova 3 prodotti vegani nuovi", emoji: "🌿", targetCount: 3, currentCount: 3, rewardPoints: 300, progressPercent: 100, isCompleted: true, category: "Alimentazione", expiresAt: "2025-02-01T00:00:00Z" }
  ];

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
      {/* Top Banner Area */}
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
        {/* Profile Card */}
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

        {/* Impact Dashboard */}
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

        {/* Invite Card */}
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

        {/* Challenges */}
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

        {/* Badges Collection */}
        <section>
          <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary" /> Collezione Badge
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {p.badges.map((badge) => (
              <div key={badge.id} className="bg-card border border-border/50 rounded-2xl p-3 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl mb-2">
                  {badge.emoji}
                </div>
                <p className="font-semibold text-xs leading-tight">{badge.name}</p>
                <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">{badge.category}</p>
              </div>
            ))}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`locked-${i}`} className="bg-muted/30 border border-dashed border-border rounded-2xl p-3 flex flex-col items-center justify-center text-center opacity-60">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="font-medium text-[10px] text-muted-foreground">Bloccato</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
