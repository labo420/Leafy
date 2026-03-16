import React from "react";
import { useGetProfile } from "@workspace/api-client-react";
import { LevelProgress } from "@/components/shared/LevelProgress";
import { Button } from "@/components/ui/button";
import { Flame, Camera } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: profile, isLoading } = useGetProfile();

  if (isLoading) {
    return (
      <div className="p-6 pt-12 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Caricamento Leafy...</p>
      </div>
    );
  }

  const p = profile || {
    id: 1, username: "Guest", email: "guest@leafy.app", totalPoints: 1250,
    level: "Ramoscello", levelProgress: 65, nextLevelPoints: 2000, streak: 5, badgesCount: 12, badges: []
  };

  const motivationalMessages = [
    `Oggi sei già un passo avanti, ${p.username}! 🌿`,
    `Stai accumulando punti reali, ${p.username}! 🏆`,
    `Ogni scontrino vale qualcosa per te. 💫`,
    `Grande slancio questa settimana, ${p.username}! ♻️`,
    `${p.totalPoints} punti nel tuo portafoglio — continua così! 🎁`,
    `Potresti sorprenderti di quanti punti guadagni già. 🛒`,
    `Ogni scelta conta. La tua fa la differenza! 🌱`,
  ];
  const message = motivationalMessages[p.streak % motivationalMessages.length];

  return (
    <div className="p-6 pt-10 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}images/leafy-icon-dark.png`} alt="Leafy Logo" className="w-full h-full object-cover" />
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
            <span>{p.nextLevelPoints?.toLocaleString("it-IT")} pts per il prossimo livello</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${p.levelProgress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Motivational message */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl px-5 py-4 text-center">
        <p className="text-sm font-medium text-primary leading-relaxed">{message}</p>
      </div>

      {/* Main CTA */}
      <Link href="/scan" className="block w-full">
        <Button className="w-full h-16 text-lg rounded-2xl gap-3 shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-[#23533e] hover:scale-[1.02] transition-transform">
          <Camera className="w-6 h-6" />
          Analizza la tua spesa
        </Button>
      </Link>
    </div>
  );
}
