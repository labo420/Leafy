import React from "react";
import { Camera, Droplets, Flame, Gift, Home, Leaf, ScrollText, User, Wind, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// Demo data
const p = {
  username: "Marco",
  level: "Argento",
  totalPoints: 1250,
  levelProgress: 65,
  nextLevelPoints: 2000,
  streak: 5,
};

const imp = {
  co2SavedKg: 14.5,
  waterSavedLiters: 120,
  greenProductsCount: 45,
};

export default function Oceano() {
  return (
    <div className="w-[390px] h-[844px] bg-[#f0f9ff] text-[#0c2d3f] overflow-hidden flex flex-col relative font-sans shadow-2xl rounded-[3rem] border-[8px] border-black mx-auto">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        <div className="p-6 pt-12 space-y-8">
          
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/60 flex items-center justify-center p-2 shadow-sm border border-sky-100">
                <Leaf className="w-6 h-6 text-[#0B7EA3]" />
              </div>
              <div>
                <h1 className="text-xl font-['Poppins'] font-bold text-[#0c2d3f]">Ciao, {p.username}!</h1>
                <p className="text-sm text-[#0c2d3f]/60 flex items-center gap-1 font-medium">
                  <Flame className="w-4 h-4 text-[#F06449]" fill="currentColor" />
                  {p.streak} giorni di fila
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md shadow-sky-900/10">
              <img src="/images/avatar.png" alt="Avatar" className="w-full h-full object-cover bg-sky-100" />
            </div>
          </header>

          {/* Main Progress */}
          <section className="flex flex-col items-center justify-center py-2 relative">
            <div className="absolute inset-0 bg-[#06B6D4]/10 rounded-full blur-3xl opacity-50 transform scale-125" />
            
            <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
              {/* Background Circle */}
              <svg className="absolute transform -rotate-90" width={220} height={220}>
                <circle
                  cx={110}
                  cy={110}
                  r={96}
                  stroke="#e0f2fe"
                  strokeWidth={14}
                  fill="transparent"
                />
                {/* Progress Circle */}
                <circle
                  cx={110}
                  cy={110}
                  r={96}
                  stroke="#06B6D4"
                  strokeWidth={14}
                  fill="transparent"
                  strokeDasharray={96 * 2 * Math.PI}
                  strokeDashoffset={(96 * 2 * Math.PI) - ((p.levelProgress / 100) * (96 * 2 * Math.PI))}
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] transition-all duration-1000 ease-out"
                />
              </svg>
              
              {/* Inner Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-semibold text-[#0B7EA3] uppercase tracking-wider mb-1">{p.level}</span>
                <span className="font-['Poppins'] text-4xl font-bold text-[#0c2d3f] tracking-tighter">
                  {new Intl.NumberFormat("it-IT").format(p.totalPoints)}
                </span>
                <span className="text-xs font-medium text-[#0c2d3f]/50 mt-1 uppercase tracking-widest">Punti</span>
              </div>
            </div>

            <div className="mt-6 w-full max-w-[260px]">
              <div className="flex justify-between text-xs font-medium text-[#0c2d3f]/60 mb-2">
                <span>{p.level}</span>
                <span>{new Intl.NumberFormat("it-IT").format(p.nextLevelPoints)} pts per l'Oro</span>
              </div>
              <div className="h-2.5 bg-sky-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#06B6D4] to-[#0B7EA3] rounded-full"
                  style={{ width: `${p.levelProgress}%` }}
                />
              </div>
            </div>
          </section>

          {/* Quick Action */}
          <button className="w-full h-16 text-lg font-['Poppins'] font-semibold rounded-2xl flex items-center justify-center gap-3 text-white shadow-lg shadow-[#0B7EA3]/30 bg-gradient-to-r from-[#0B7EA3] to-[#065a75] hover:opacity-90 transition-opacity border border-sky-400/20">
            <Camera className="w-6 h-6" />
            Scansiona Scontrino
          </button>

          {/* Impact Summary */}
          <section className="space-y-4">
            <h3 className="font-['Poppins'] font-bold text-lg text-[#0c2d3f] flex items-center gap-2">
              <Leaf className="w-5 h-5 text-[#0B7EA3]" />
              Il tuo impatto verde
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-[20px] p-4 flex flex-col items-center text-center space-y-2 border border-sky-100 shadow-[0_4px_20px_-4px_rgba(11,126,163,0.08)]">
                <div className="w-12 h-12 rounded-full bg-sky-50 text-[#0B7EA3] flex items-center justify-center mb-1 border border-sky-100">
                  <Wind className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0c2d3f] leading-none mb-1">{imp.co2SavedKg} <span className="text-sm font-medium text-[#0c2d3f]/50">kg</span></p>
                  <p className="text-xs font-medium text-[#0c2d3f]/60">CO₂ risparmiata</p>
                </div>
              </div>
              
              <div className="bg-white rounded-[20px] p-4 flex flex-col items-center text-center space-y-2 border border-sky-100 shadow-[0_4px_20px_-4px_rgba(11,126,163,0.08)]">
                <div className="w-12 h-12 rounded-full bg-cyan-50 text-[#06B6D4] flex items-center justify-center mb-1 border border-cyan-100">
                  <Droplets className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0c2d3f] leading-none mb-1">{imp.waterSavedLiters} <span className="text-sm font-medium text-[#0c2d3f]/50">L</span></p>
                  <p className="text-xs font-medium text-[#0c2d3f]/60">Acqua salvata</p>
                </div>
              </div>
              
              <div className="col-span-2 bg-gradient-to-br from-white to-sky-50 rounded-[20px] p-4 flex items-center justify-between border border-sky-200 shadow-[0_4px_20px_-4px_rgba(11,126,163,0.1)] relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-5 text-[#0B7EA3]">
                  <Zap className="w-32 h-32" />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-orange-50 text-[#F06449] flex items-center justify-center border border-orange-100 shadow-inner">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0c2d3f]/60 mb-0.5">Prodotti Green Acquistati</p>
                    <p className="text-2xl font-bold text-[#0c2d3f] leading-none">{imp.greenProductsCount}</p>
                  </div>
                </div>
                <div className="bg-[#F06449]/10 text-[#F06449] px-3 py-1 rounded-full text-xs font-bold relative z-10 border border-[#F06449]/20">
                  +3 oggi
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-sky-100 pb-safe pt-2 px-6">
        <nav className="flex justify-between items-center h-20 pb-4">
          <div className="flex flex-col items-center gap-1 text-[#0B7EA3] relative">
            <div className="absolute -top-4 w-10 h-1 bg-[#0B7EA3] rounded-full" />
            <div className="p-2 rounded-xl bg-sky-50">
              <Home className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold">Home</span>
          </div>
          
          <div className="flex flex-col items-center gap-1 text-[#0c2d3f]/40 hover:text-[#0B7EA3] transition-colors">
            <div className="p-2 rounded-xl">
              <Camera className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium">Scan</span>
          </div>
          
          <div className="flex flex-col items-center gap-1 text-[#0c2d3f]/40 hover:text-[#0B7EA3] transition-colors">
            <div className="p-2 rounded-xl">
              <ScrollText className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium">Storico</span>
          </div>
          
          <div className="flex flex-col items-center gap-1 text-[#0c2d3f]/40 hover:text-[#0B7EA3] transition-colors">
            <div className="p-2 rounded-xl">
              <Gift className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium">Premi</span>
          </div>
          
          <div className="flex flex-col items-center gap-1 text-[#0c2d3f]/40 hover:text-[#0B7EA3] transition-colors">
            <div className="p-2 rounded-xl">
              <User className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium">Profilo</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
