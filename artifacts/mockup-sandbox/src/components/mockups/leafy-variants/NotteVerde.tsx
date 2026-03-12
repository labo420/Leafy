import React from 'react';
import { Home, Camera, ScrollText, Gift, User, Wind, Droplets, Zap, Leaf, Flame } from 'lucide-react';

export function NotteVerde() {
  const p = {
    username: "Marco",
    level: "Argento",
    totalPoints: 1250,
    levelProgress: 65,
    streak: 5,
  };

  const imp = {
    co2SavedKg: 14.5,
    waterSavedLiters: 120,
    greenProductsCount: 45,
  };

  const size = 240;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (p.levelProgress / 100) * circumference;

  return (
    <div className="w-[390px] h-[844px] bg-[#0d1f16] text-[#e8f0eb] relative overflow-hidden flex flex-col font-sans shadow-2xl rounded-[40px] border-[8px] border-black">
      <div className="flex-1 overflow-y-auto pb-24 p-6 pt-12 space-y-8 no-scrollbar">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#52B788]/20 flex items-center justify-center p-1.5 shadow-inner border border-[#52B788]/10">
              <Leaf className="w-6 h-6 text-[#52B788]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-['DM_Sans'] text-[#e8f0eb]">Ciao, {p.username}!</h1>
              <p className="text-sm text-[#e8f0eb]/60 flex items-center gap-1">
                <Flame className="w-4 h-4 text-[#F4A261]" fill="currentColor" />
                {p.streak} giorni di fila
              </p>
            </div>
          </div>
          <div className="block">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#0a1810] shadow-md bg-[#2D6A4F] flex items-center justify-center">
               <User className="w-6 h-6 text-[#52B788]" />
            </div>
          </div>
        </header>

        {/* Main Progress */}
        <section className="flex flex-col items-center justify-center py-4 relative">
          <div className="absolute inset-0 bg-[#52B788]/5 rounded-full blur-3xl opacity-50 transform scale-150" />
          
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="absolute transform -rotate-90" width={size} height={size}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#52B788"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(82,183,136,0.3)]"
                style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-semibold text-[#52B788] uppercase tracking-wider mb-1 font-['DM_Sans']">{p.level}</span>
              <span className="font-['DM_Sans'] text-5xl font-bold text-[#e8f0eb] tracking-tighter">
                {new Intl.NumberFormat("it-IT").format(p.totalPoints)}
              </span>
              <span className="text-xs font-medium text-[#e8f0eb]/50 mt-1">PUNTI</span>
            </div>
          </div>

          <div className="mt-6 w-full max-w-[280px]">
            <div className="flex justify-between text-xs font-medium text-[#e8f0eb]/60 mb-2">
              <span>{p.level}</span>
              <span>2.000 pts per l'Oro</span>
            </div>
            <div className="h-2.5 bg-[#0a1810] rounded-full overflow-hidden border border-[rgba(255,255,255,0.05)]">
              <div 
                className="h-full bg-gradient-to-r from-[#2D6A4F] to-[#52B788] rounded-full"
                style={{ width: `${p.levelProgress}%` }}
              />
            </div>
          </div>
        </section>

        {/* Quick Action */}
        <button className="w-full h-16 text-lg rounded-2xl gap-3 flex items-center justify-center shadow-xl shadow-[#52B788]/10 bg-gradient-to-r from-[#52B788] to-[#2D6A4F] text-white font-medium hover:scale-[1.02] transition-transform">
          <Camera className="w-6 h-6" />
          Scansiona Scontrino
        </button>

        {/* Impact Summary */}
        <section className="space-y-4">
          <h3 className="font-['DM_Sans'] font-bold text-lg text-[#e8f0eb] flex items-center gap-2">
            <Leaf className="w-5 h-5 text-[#52B788]" />
            Il tuo impatto verde
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[rgba(255,255,255,0.06)] backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.05)] p-4 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-900/30 text-[#60A5FA] flex items-center justify-center mb-1">
                <Wind className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-[#e8f0eb] font-['DM_Sans']">{imp.co2SavedKg} <span className="text-sm font-medium text-[#e8f0eb]/50">kg</span></p>
              <p className="text-xs text-[#e8f0eb]/60">CO₂ risparmiata</p>
            </div>
            
            <div className="bg-[rgba(255,255,255,0.06)] backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.05)] p-4 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-teal-900/30 text-[#2DD4BF] flex items-center justify-center mb-1">
                <Droplets className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-[#e8f0eb] font-['DM_Sans']">{imp.waterSavedLiters} <span className="text-sm font-medium text-[#e8f0eb]/50">L</span></p>
              <p className="text-xs text-[#e8f0eb]/60">Acqua salvata</p>
            </div>
            
            <div className="col-span-2 bg-gradient-to-br from-[#F4A261]/10 to-[rgba(255,255,255,0.03)] backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.05)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#F4A261]/20 text-[#F4A261] flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#e8f0eb]/60">Prodotti Green Acquistati</p>
                  <p className="text-2xl font-bold text-[#e8f0eb] font-['DM_Sans']">{imp.greenProductsCount}</p>
                </div>
              </div>
              <div className="bg-[#F4A261]/20 text-[#F4A261] px-3 py-1 rounded-full text-xs font-semibold">
                +3 oggi
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 w-full bg-[#0a1810]/90 backdrop-blur-xl border-t border-[rgba(255,255,255,0.05)] pb-5 pt-2 px-6 z-40 rounded-b-[32px]">
        <nav className="flex justify-between items-center h-16">
          {[
            { icon: Home, label: "Home", active: true },
            { icon: Camera, label: "Scan", active: false },
            { icon: ScrollText, label: "Storico", active: false },
            { icon: Gift, label: "Premi", active: false },
            { icon: User, label: "Profilo", active: false },
          ].map((item, i) => (
            <div key={i} className="relative flex-1 flex flex-col items-center justify-center gap-1 group cursor-pointer">
              {item.active && (
                <div className="absolute -top-3 w-10 h-1 bg-[#52B788] rounded-full shadow-[0_0_8px_#52B788]" />
              )}
              <div className={`p-2 rounded-2xl transition-colors ${item.active ? 'bg-[#52B788]/10 text-[#52B788]' : 'text-[#e8f0eb]/40'}`}>
                <item.icon className="w-6 h-6" strokeWidth={item.active ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${item.active ? 'text-[#52B788] font-bold' : 'text-[#e8f0eb]/40'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </nav>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}

export default NotteVerde;