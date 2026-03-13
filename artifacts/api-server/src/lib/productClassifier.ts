import { db, productCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { FoundItem, GreenCategory } from "./scanner.js";

const ECO_SCORE_POINTS: Record<string, number> = {
  a: 20,
  b: 15,
  c: 8,
  d: 3,
  e: 0,
};

const ECO_SCORE_EMOJI: Record<string, string> = {
  a: "🌿",
  b: "♻️",
  c: "🌱",
  d: "⚠️",
  e: "❌",
};

interface OpenFoodFactsProduct {
  product_name?: string;
  ecoscore_grade?: string;
  ecoscore_score?: number;
  labels?: string;
  categories?: string;
  packaging_tags?: string[];
  origins?: string;
}

async function searchOpenFoodFacts(name: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const encoded = encodeURIComponent(name);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&json=1&page_size=3&action=process&fields=product_name,ecoscore_grade,ecoscore_score,labels,categories,packaging_tags,origins&lang=it&country=it`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as { products?: OpenFoodFactsProduct[] };
    const products = data.products ?? [];
    const valid = products.find(p => p.ecoscore_grade && p.ecoscore_grade !== "not-applicable" && p.ecoscore_grade !== "unknown");
    return valid ?? null;
  } catch {
    return null;
  }
}

interface AIClassification {
  points: number;
  category: string;
  emoji: string;
  reasoning: string;
  ecoScore: string | null;
}

async function classifyWithAI(productName: string): Promise<AIClassification> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Sei un esperto di sostenibilità ambientale. Analizza questo prodotto trovato su uno scontrino italiano e assegna un punteggio di sostenibilità.

Prodotto: "${productName}"

Rispondi SOLO con un JSON valido, nessun altro testo:
{
  "points": <numero 0-20, dove 0=non sostenibile, 20=eccellente>,
  "category": <una di: "Bio", "Km 0", "Vegano", "Senza Plastica", "Equo Solidale", "DOP/IGP", "Artigianale", "Altro">,
  "emoji": <un emoji appropriato>,
  "reasoning": <spiegazione breve in italiano di max 100 caratteri>,
  "ecoScore": <"a","b","c","d","e" oppure null se non determinabile>
}

Criteri:
- 0 punti: prodotti non alimentari generici, prodotti ad alto impatto ambientale
- 5-8 punti: prodotti standard senza certificazioni particolari
- 10-14 punti: frutta/verdura fresca, prodotti vegetali, cereali non lavorati
- 15-20 punti: prodotti bio, vegani certificati, km 0, equo solidale, DOP/IGP

Se il prodotto non è chiaramente alimentare o non riesci a determinarlo, assegna 0 punti.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return JSON.parse(jsonMatch[0]) as AIClassification;
  } catch {
    return { points: 5, category: "Altro", emoji: "🌿", reasoning: "Classificazione non disponibile", ecoScore: null };
  }
}

function normalizeProductName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9àèéìòù ]/g, "");
}

export function extractProductLines(ocrText: string): string[] {
  const lines = ocrText.split("\n");
  const products: string[] = [];

  const skipPatterns = [
    /^\s*$/,
    /^[-=*_.]{3,}/,
    /totale|subtotal|iva|sconto|resto|contante|credito|pagamento|scontrino|ricevuta|grazie|arriveder/i,
    /\b(via|viale|corso|piazza|largo|p\.iva|cf|tel|fax|www|http|@)/i,
    /^\s*\d{1,2}[/:]\d{2}/,
    /^\s*[\d.,]{4,}\s*$/,
    /^\s*\*+\s*$/,
    /^\s*n\.\s*\d/i,
    /cassa|cassiera|operatore|esercente|matricola/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 60) continue;
    if (skipPatterns.some(p => p.test(trimmed))) continue;

    const cleanedLine = trimmed
      .replace(/\s+\d+[.,]\d{2}\s*[€*]?\s*$/, "")
      .replace(/^\d+\s+x\s+/i, "")
      .replace(/\s{2,}.*$/, "")
      .trim();

    if (cleanedLine.length >= 3 && /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(cleanedLine)) {
      products.push(cleanedLine);
    }
  }

  return [...new Set(products)].slice(0, 20);
}

export async function classifyProducts(productLines: string[]): Promise<FoundItem[]> {
  const results: FoundItem[] = [];

  for (const line of productLines) {
    const normalized = normalizeProductName(line);
    if (!normalized || normalized.length < 3) continue;

    const cached = await db
      .select()
      .from(productCacheTable)
      .where(eq(productCacheTable.productNameNormalized, normalized))
      .limit(1);

    if (cached.length > 0) {
      const entry = cached[0];
      if (entry.points > 0) {
        results.push({
          name: entry.productNameOriginal,
          category: (entry.category || "Altro") as GreenCategory,
          points: entry.points,
          emoji: entry.emoji,
        });
      }
      continue;
    }

    let classification: { points: number; category: string; emoji: string; reasoning: string; ecoScore: string | null };

    const offProduct = await searchOpenFoodFacts(line);
    if (offProduct && offProduct.ecoscore_grade) {
      const grade = offProduct.ecoscore_grade.toLowerCase();
      const points = ECO_SCORE_POINTS[grade] ?? 5;
      const emoji = ECO_SCORE_EMOJI[grade] ?? "🌿";

      const categories: string[] = [];
      if (offProduct.labels?.toLowerCase().includes("bio") || offProduct.labels?.toLowerCase().includes("organic")) {
        categories.push("Bio");
      }
      if (offProduct.labels?.toLowerCase().includes("vegan")) categories.push("Vegano");
      if (offProduct.labels?.toLowerCase().includes("fair")) categories.push("Equo Solidale");
      const category = categories[0] ?? "Eco-Score " + grade.toUpperCase();

      classification = {
        points,
        category,
        emoji,
        reasoning: `Eco-Score ${grade.toUpperCase()} da Open Food Facts`,
        ecoScore: grade,
      };
    } else {
      const aiResult = await classifyWithAI(line);
      classification = aiResult;
    }

    await db.insert(productCacheTable).values({
      productNameNormalized: normalized,
      productNameOriginal: line,
      ecoScore: classification.ecoScore,
      points: classification.points,
      category: classification.category,
      source: offProduct ? "openfoodfacts" : "ai",
      reasoning: classification.reasoning,
      emoji: classification.emoji,
    }).onConflictDoNothing();

    if (classification.points > 0) {
      results.push({
        name: line,
        category: classification.category as GreenCategory,
        points: classification.points,
        emoji: classification.emoji,
      });
    }
  }

  return results;
}
