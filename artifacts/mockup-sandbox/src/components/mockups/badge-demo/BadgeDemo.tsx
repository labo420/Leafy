import { useState } from "react";
import { Card, CardContent } from "../../ui/card";

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
    return `Sett. ${parseInt(week)} — ${year}`;
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

const mockLifetimeBadges = [
  { id: 1, name: "Pioniere Bio", emoji: "🌱", category: "Prima volta", unlockHint: "Scansiona il tuo primo prodotto biologico", isUnlocked: true, unlockedAt: "2025-11-15T10:30:00Z", currentProgress: 1, targetCount: 1 },
  { id: 2, name: "Primo Scontrino", emoji: "🧾", category: "Prima volta", unlockHint: "Scansiona il tuo primo scontrino", isUnlocked: true, unlockedAt: "2025-11-14T08:00:00Z", currentProgress: 1, targetCount: 1 },
  { id: 3, name: "Eroe Locale", emoji: "📍", category: "Prodotto", unlockHint: "Acquista 5 prodotti a Km 0", isUnlocked: true, unlockedAt: "2026-01-20T14:00:00Z", currentProgress: 5, targetCount: 5 },
  { id: 4, name: "Amico degli Oceani", emoji: "🐬", category: "Prodotto", unlockHint: "Acquista 10 prodotti senza plastica", isUnlocked: false, unlockedAt: null, currentProgress: 7, targetCount: 10 },
  { id: 5, name: "Re del Riciclo", emoji: "♻️", category: "Volume", unlockHint: "Scansiona 50 prodotti green", isUnlocked: false, unlockedAt: null, currentProgress: 32, targetCount: 50 },
  { id: 6, name: "Maratoneta Verde", emoji: "🏃", category: "Volume", unlockHint: "Scansiona 100 scontrini", isUnlocked: false, unlockedAt: null, currentProgress: 18, targetCount: 100 },
  { id: 7, name: "Livello Argento", emoji: "🥈", category: "Livello", unlockHint: "Accumula abbastanza punti per il livello Argento", isUnlocked: true, unlockedAt: "2026-02-10T16:45:00Z", currentProgress: 1, targetCount: 1 },
  { id: 8, name: "Livello Oro", emoji: "🥇", category: "Livello", unlockHint: "Accumula abbastanza punti per il livello Oro", isUnlocked: false, unlockedAt: null, currentProgress: 0, targetCount: 1 },
  { id: 9, name: "Ambasciatore", emoji: "👥", category: "Sociale", unlockHint: "Invita 5 amici con il tuo codice referral", isUnlocked: false, unlockedAt: null, currentProgress: 2, targetCount: 5 },
  { id: 10, name: "Livello Platino", emoji: "💎", category: "Livello", unlockHint: "Accumula abbastanza punti per il livello Platino", isUnlocked: false, unlockedAt: null, currentProgress: 0, targetCount: 1 },
];

const mockTemporalBadges = [
  { id: 11, name: "Streak 7 giorni", emoji: "🔥", category: "Streak", unlockHint: "Usa Leafy per 7 giorni di fila", badgeType: "weekly" as const, periodKey: "2026-W11", isUnlocked: false, unlockedAt: null, currentProgress: 4, targetCount: 7, isExpired: false },
  { id: 12, name: "Settimana Plastic-Free", emoji: "🌊", category: "Sfida", unlockHint: "Acquista 5 prodotti plastic-free in una settimana", badgeType: "weekly" as const, periodKey: "2026-W11", isUnlocked: true, unlockedAt: "2026-03-11T18:00:00Z", currentProgress: 5, targetCount: 5, isExpired: false },
  { id: 13, name: "Campione del Mese", emoji: "🏆", category: "Volume", unlockHint: "Scansiona 20 prodotti green questo mese", badgeType: "monthly" as const, periodKey: "2026-03", isUnlocked: false, unlockedAt: null, currentProgress: 12, targetCount: 20, isExpired: false },
  { id: 14, name: "Vegano Curioso", emoji: "🌿", category: "Sfida", unlockHint: "Acquista 5 prodotti vegani diversi", badgeType: "monthly" as const, periodKey: "2026-03", isUnlocked: false, unlockedAt: null, currentProgress: 2, targetCount: 5, isExpired: false },
  { id: 15, name: "Eco-Warrior Stagionale", emoji: "🌍", category: "Sfida", unlockHint: "Completa 10 sfide questo trimestre", badgeType: "seasonal" as const, periodKey: "2026-Q1", isUnlocked: false, unlockedAt: null, currentProgress: 3, targetCount: 10, isExpired: false },

  { id: 11, name: "Streak 7 giorni", emoji: "🔥", category: "Streak", unlockHint: "Usa Leafy per 7 giorni di fila", badgeType: "weekly" as const, periodKey: "2026-W10", isUnlocked: true, unlockedAt: "2026-03-05T20:00:00Z", currentProgress: 7, targetCount: 7, isExpired: true },
  { id: 12, name: "Settimana Plastic-Free", emoji: "🌊", category: "Sfida", unlockHint: "Acquista 5 prodotti plastic-free in una settimana", badgeType: "weekly" as const, periodKey: "2026-W10", isUnlocked: false, unlockedAt: null, currentProgress: 3, targetCount: 5, isExpired: true },
  { id: 13, name: "Campione del Mese", emoji: "🏆", category: "Volume", unlockHint: "Scansiona 20 prodotti green questo mese", badgeType: "monthly" as const, periodKey: "2026-02", isUnlocked: true, unlockedAt: "2026-02-25T12:00:00Z", currentProgress: 20, targetCount: 20, isExpired: true },
  { id: 14, name: "Vegano Curioso", emoji: "🌿", category: "Sfida", unlockHint: "Acquista 5 prodotti vegani diversi", badgeType: "monthly" as const, periodKey: "2026-02", isUnlocked: true, unlockedAt: "2026-02-20T09:30:00Z", currentProgress: 5, targetCount: 5, isExpired: true },
];

function ProgressBar({ progress, total, color = "bg-amber-400/60" }: { progress: number; total: number; color?: string }) {
  const pct = Math.min(100, (progress / total) * 100);
  return (
    <div className="w-full space-y-0.5">
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-gray-400 text-right">{progress}/{total}</p>
    </div>
  );
}

export function BadgeDemo() {
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("traguardi");
  const activeTemporal = mockTemporalBadges.filter(b => !b.isExpired);
  const archivedTemporal = mockTemporalBadges.filter(b => b.isExpired);

  return (
    <div className="min-h-screen" style={{ background: "hsl(75 25% 96%)", fontFamily: "'Inter', sans-serif", color: "hsl(158 25% 14%)" }}>
      <div style={{ background: "hsl(27 87% 67% / 0.9)", color: "white", textAlign: "center", padding: "8px 16px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>ℹ️</span> Anteprima — dati di esempio
      </div>

      <div style={{ background: "hsl(153 40% 30%)", paddingTop: 48, paddingBottom: 96, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 256, height: 256, background: "rgba(255,255,255,0.05)", borderRadius: "50%", filter: "blur(48px)", transform: "translate(50%,-50%)" }} />
        <div className="flex justify-between items-start relative z-10">
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 30, color: "white" }}>Profilo</h1>
          <button style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", border: "none", backdropFilter: "blur(12px)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      <div style={{ padding: "0 24px", marginTop: -64, position: "relative", zIndex: 20 }}>
        <Card className="border-transparent shadow-xl overflow-visible mb-6">
          <CardContent className="p-6 flex flex-col items-center text-center overflow-visible">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden -mt-16 mb-4" style={{ background: "hsl(153 40% 30% / 0.2)" }}>
              <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 24 }} className="mb-4">MarcoVerdi92</h2>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "hsl(105 20% 90% / 0.5)" }}>
              <span style={{ color: "hsl(27 87% 67%)" }}>🏆</span>
              <span className="font-bold">Livello Argento</span>
            </div>
          </CardContent>
        </Card>

        <section className="mb-6">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: "hsl(153 40% 30%)" }}>🏅</span> Collezione Badge
          </h3>

          <div className="flex rounded-xl p-1 mb-4" style={{ background: "hsl(105 20% 90% / 0.5)" }}>
            <button
              onClick={() => setBadgeTab("traguardi")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                badgeTab === "traguardi" ? "bg-white shadow-sm" : "opacity-60 hover:opacity-80"
              }`}
              style={{ border: "none", cursor: "pointer" }}
            >
              🏅 Traguardi
            </button>
            <button
              onClick={() => setBadgeTab("sfide")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                badgeTab === "sfide" ? "bg-white shadow-sm" : "opacity-60 hover:opacity-80"
              }`}
              style={{ border: "none", cursor: "pointer" }}
            >
              🗓️ Sfide
            </button>
          </div>

          {badgeTab === "traguardi" ? (
            <div className="grid grid-cols-2 gap-3">
              {mockLifetimeBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-2xl p-4 flex flex-col items-center text-center transition-shadow ${
                    badge.isUnlocked
                      ? "bg-white border shadow-sm hover:shadow-md"
                      : "border border-dashed opacity-70"
                  }`}
                  style={{ borderColor: badge.isUnlocked ? "hsl(105 15% 85% / 0.5)" : "hsl(105 15% 85% / 0.4)" }}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2 ${
                    badge.isUnlocked ? "" : "blur-[2px]"
                  }`} style={{ background: badge.isUnlocked ? "hsl(153 40% 30% / 0.1)" : "hsl(105 20% 90% / 0.5)" }}>
                    {badge.emoji}
                  </div>
                  <p className="font-semibold text-xs leading-tight mb-1">{badge.name}</p>
                  <p className="text-[9px] uppercase tracking-wider mb-2" style={{ color: "hsl(158 15% 45%)" }}>{badge.category}</p>
                  
                  {badge.isUnlocked ? (
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: "hsl(153 40% 30%)" }}>
                      <span>📅</span>
                      <span>Sbloccato il {formatDate(badge.unlockedAt)}</span>
                    </div>
                  ) : (
                    <div className="w-full space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: "hsl(158 15% 45%)" }}>
                        <span>🔒</span>
                        <span className="truncate">{badge.unlockHint}</span>
                      </div>
                      {badge.targetCount > 1 && (
                        <ProgressBar progress={badge.currentProgress} total={badge.targetCount} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {activeTemporal.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "hsl(153 40% 30%)" }}>
                    <span>🕐</span> Attive
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {activeTemporal.map((badge, i) => (
                      <div
                        key={`${badge.id}-${badge.periodKey}-${i}`}
                        className={`rounded-2xl p-4 flex flex-col items-center text-center transition-shadow ${
                          badge.isUnlocked
                            ? "bg-white border shadow-sm ring-1"
                            : "bg-white border shadow-sm"
                        }`}
                        style={{
                          borderColor: badge.isUnlocked ? "hsl(153 40% 30% / 0.2)" : "hsl(105 15% 85% / 0.5)",
                          ...(badge.isUnlocked ? { boxShadow: "0 0 0 1px hsl(153 40% 30% / 0.1)" } : {})
                        }}
                      >
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2" style={{
                          background: badge.isUnlocked ? "hsl(153 40% 30% / 0.1)" : "hsl(27 87% 67% / 0.1)"
                        }}>
                          {badge.emoji}
                        </div>
                        <p className="font-semibold text-xs leading-tight mb-1">{badge.name}</p>
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full mb-2" style={{ background: "hsl(105 20% 90%)", color: "hsl(158 15% 45%)" }}>
                          {periodLabel(badge.badgeType)}
                        </span>
                        
                        {badge.isUnlocked ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-semibold" style={{ color: "hsl(153 40% 30%)" }}>Completata!</span>
                            <div className="flex items-center gap-1 text-[9px]" style={{ color: "hsl(158 15% 45%)" }}>
                              <span>📅</span>
                              <span>{formatDate(badge.unlockedAt)}</span>
                            </div>
                          </div>
                        ) : (
                          <ProgressBar progress={badge.currentProgress} total={badge.targetCount} color="bg-amber-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {archivedTemporal.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(158 15% 45%)" }}>
                    Archivio
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {archivedTemporal.map((badge, i) => (
                      <div
                        key={`${badge.id}-${badge.periodKey}-${i}`}
                        className={`rounded-xl p-3 flex flex-col items-center text-center ${
                          badge.isUnlocked ? "border" : "border border-dashed opacity-50"
                        }`}
                        style={{
                          background: badge.isUnlocked ? "hsl(105 20% 90% / 0.3)" : "hsl(105 20% 90% / 0.15)",
                          borderColor: badge.isUnlocked ? "hsl(105 15% 85% / 0.3)" : "hsl(105 15% 85% / 0.2)"
                        }}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1 grayscale ${
                          badge.isUnlocked ? "opacity-70" : "opacity-30"
                        }`}>
                          {badge.emoji}
                        </div>
                        <p className="font-medium text-[10px] leading-tight" style={{ color: "hsl(158 15% 45%)" }}>{badge.name}</p>
                        <p className="text-[8px] mt-0.5" style={{ color: "hsl(158 15% 45% / 0.6)" }}>{formatPeriod(badge.periodKey, badge.badgeType)}</p>
                        {badge.isUnlocked && badge.unlockedAt && (
                          <p className="text-[7px] mt-0.5" style={{ color: "hsl(158 15% 45% / 0.5)" }}>{formatDate(badge.unlockedAt)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
