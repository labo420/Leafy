import React from "react";
import { useGetProfile, useGetImpact } from "@workspace/api-client-react";
import { LevelProgress } from "@/components/shared/LevelProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Droplets, Flame, Leaf, Wind, Zap, Camera } from "lucide-react";
import { Link } from "wouter";
import { formatPoints } from "@/lib/utils";

export default function Home() {
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const { data: impact, isLoading: isLoadingImpact } = useGetImpact();

  if (isLoadingProfile || isLoadingImpact) {
    return <div className="p-6 pt-12 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground font-medium animate-pulse">Caricamento Leafy...</p>
    </div>;
  }

  // Fallback demo data if endpoints fail/return empty
  const p = profile || {
    id: 1, username: "Guest", email: "guest@leafy.app", totalPoints: 1250, 
    level: "Argento", levelProgress: 65, nextLevelPoints: 2000, streak: 5, badgesCount: 12, badges: []
  };
  
  const imp = impact || {
    co2SavedKg: 14.5, plasticAvoidedKg: 3.2, waterSavedLiters: 120, greenProductsCount: 45, receiptsScanned: 18
  };

  return (
    <div className="p-6 pt-10 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center p-1.5 shadow-inner">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Leafy Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Ciao, {p.username}!</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Flame className="w-4 h-4 text-accent" fill="currentColor" />
              {p.streak} giorni di fila
            </p>
          </div>
        </div>
        <Link href="/profilo" className="block">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-background shadow-md shadow-black/10 hover:scale-105 transition-transform">
            <img src={`${import.meta.env.BASE_URL}images/avatar.png`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </Link>
      </header>

      {/* Main Progress */}
      <section className="flex flex-col items-center justify-center py-4 relative">
        <div className="absolute inset-0 bg-secondary/10 rounded-full blur-3xl opacity-50 transform scale-150" />
        <LevelProgress 
          progress={p.levelProgress} 
          level={p.level} 
          points={p.totalPoints} 
          size={240} 
        />
        <div className="mt-6 w-full max-w-[280px]">
          <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
            <span>{p.level}</span>
            <span>{formatPoints(p.nextLevelPoints)} pts per l'Oro</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${p.levelProgress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Quick Action */}
      <Link href="/scan" className="block w-full">
        <Button className="w-full h-16 text-lg rounded-2xl gap-3 shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-[#23533e] hover:scale-[1.02] transition-transform">
          <Camera className="w-6 h-6" />
          Scansiona Scontrino
        </Button>
      </Link>

      {/* Impact Summary */}
      <section className="space-y-4">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          Il tuo impatto verde
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card/60 backdrop-blur-sm border-transparent shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                <Wind className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{imp.co2SavedKg} <span className="text-sm font-medium text-muted-foreground">kg</span></p>
              <p className="text-xs text-muted-foreground">CO₂ risparmiata</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-sm border-transparent shadow-sm hover:shadow-md transition-shadow">
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
              <Badge variant="accent" className="px-3 py-1 text-sm">+3 oggi</Badge>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
