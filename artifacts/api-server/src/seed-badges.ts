import { db, badgesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const seedBadges = [
  { name: "Pioniere Bio", emoji: "🌱", category: "Prima volta", description: "Hai scansionato il tuo primo prodotto bio!", unlockHint: "Scansiona il tuo primo prodotto biologico", badgeType: "lifetime" as const, targetCount: 1 },
  { name: "Primo Scontrino", emoji: "🧾", category: "Prima volta", description: "Hai scansionato il tuo primo scontrino!", unlockHint: "Scansiona il tuo primo scontrino", badgeType: "lifetime" as const, targetCount: 1 },
  { name: "Eroe Locale", emoji: "📍", category: "Prodotto", description: "Hai acquistato 5 prodotti a Km 0", unlockHint: "Acquista 5 prodotti a Km 0", badgeType: "lifetime" as const, targetCount: 5 },
  { name: "Amico degli Oceani", emoji: "🐬", category: "Prodotto", description: "Hai acquistato 10 prodotti plastic-free", unlockHint: "Acquista 10 prodotti senza plastica", badgeType: "lifetime" as const, targetCount: 10 },
  { name: "Re del Riciclo", emoji: "♻️", category: "Volume", description: "Hai scansionato 50 prodotti green", unlockHint: "Scansiona 50 prodotti green", badgeType: "lifetime" as const, targetCount: 50 },
  { name: "Maratoneta Verde", emoji: "🏃", category: "Volume", description: "Hai scansionato 100 scontrini", unlockHint: "Scansiona 100 scontrini", badgeType: "lifetime" as const, targetCount: 100 },
  { name: "Livello Argento", emoji: "🥈", category: "Livello", description: "Hai raggiunto il livello Argento!", unlockHint: "Accumula abbastanza punti per il livello Argento", badgeType: "lifetime" as const, targetCount: 1 },
  { name: "Livello Oro", emoji: "🥇", category: "Livello", description: "Hai raggiunto il livello Oro!", unlockHint: "Accumula abbastanza punti per il livello Oro", badgeType: "lifetime" as const, targetCount: 1 },
  { name: "Livello Platino", emoji: "💎", category: "Livello", description: "Hai raggiunto il livello Platino!", unlockHint: "Accumula abbastanza punti per il livello Platino", badgeType: "lifetime" as const, targetCount: 1 },
  { name: "Ambasciatore", emoji: "👥", category: "Sociale", description: "Hai invitato 5 amici su Leafy", unlockHint: "Invita 5 amici con il tuo codice referral", badgeType: "lifetime" as const, targetCount: 5 },

  { name: "Eroe Settimanale", emoji: "🔥", category: "Streak", description: "Scansiona almeno un prodotto per 7 giorni consecutivi", unlockHint: "Usa Leafy per 7 giorni di fila", badgeType: "weekly" as const, targetCount: 7 },
  { name: "Settimana Plastic-Free", emoji: "🌊", category: "Sfida", description: "Compra solo prodotti senza plastica per una settimana", unlockHint: "Acquista 5 prodotti plastic-free in una settimana", badgeType: "weekly" as const, targetCount: 5 },
  { name: "Campione del Mese", emoji: "🏆", category: "Volume", description: "Scansiona 20 prodotti green in un mese", unlockHint: "Scansiona 20 prodotti green questo mese", badgeType: "monthly" as const, targetCount: 20 },
  { name: "Vegano Curioso", emoji: "🌿", category: "Sfida", description: "Prova 5 prodotti vegani nuovi questo mese", unlockHint: "Acquista 5 prodotti vegani diversi", badgeType: "monthly" as const, targetCount: 5 },
  { name: "Guerriero Invernale", emoji: "🌍", category: "Sfida", description: "Completa 10 sfide in un trimestre", unlockHint: "Completa 10 sfide questo trimestre", badgeType: "seasonal" as const, targetCount: 10 },
];

export async function seedAllBadges() {
  for (const badge of seedBadges) {
    const existing = await db.select().from(badgesTable)
      .where(eq(badgesTable.name, badge.name));
    if (existing.length === 0) {
      await db.insert(badgesTable).values(badge);
    }
  }
  const total = await db.select().from(badgesTable);
  console.log(`Badges ready: ${total.length} total (${seedBadges.length} expected).`);
}
