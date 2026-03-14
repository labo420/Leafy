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
  ecoscore_data?: {
    agribalyse?: {
      co2_total?: number;
    };
  };
}

const BASELINE_CO2_PER_KG = 3.5;
const TYPICAL_UNIT_KG = 0.25;

function co2SavingsFromAgribalyse(product: OpenFoodFactsProduct): number | null {
  const co2Total = product.ecoscore_data?.agribalyse?.co2_total;
  if (typeof co2Total !== "number") return null;
  return Math.max(0, Math.round((BASELINE_CO2_PER_KG - co2Total) * TYPICAL_UNIT_KG * 100) / 100);
}

const CO2_BY_CATEGORY: Record<string, number> = {
  "Bio": 0.8,
  "Km 0": 0.4,
  "Vegano": 2.0,
  "Equo Solidale": 0.2,
  "DOP/IGP": 0.3,
  "Artigianale": 0.1,
  "Senza Plastica": 0.1,
  "Altro": 0.1,
};

function co2SavingsByCategory(category: string, points: number): number {
  if (points === 0) return 0;
  return CO2_BY_CATEGORY[category] ?? 0.1;
}

async function searchOpenFoodFacts(name: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const encoded = encodeURIComponent(name);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&json=1&page_size=3&action=process&fields=product_name,ecoscore_grade,ecoscore_score,ecoscore_data,labels,categories,packaging_tags,origins&lang=it&country=it`;
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

function capitalizeProductName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
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

export interface BarcodeResult {
  productName: string;
  ecoScore: string | null;
  points: number;
  category: string;
  emoji: string;
  reasoning: string;
  source: string;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeResult | null> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode || normalizedBarcode.length < 4) return null;

  const cached = await db
    .select()
    .from(productCacheTable)
    .where(eq(productCacheTable.productNameNormalized, `barcode:${normalizedBarcode}`))
    .limit(1);

  if (cached.length > 0) {
    const entry = cached[0];
    return {
      productName: entry.productNameOriginal,
      ecoScore: entry.ecoScore,
      points: entry.points,
      category: entry.category,
      emoji: entry.emoji,
      reasoning: entry.reasoning,
      source: entry.source,
    };
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(normalizedBarcode)}.json?fields=product_name,ecoscore_grade,ecoscore_score,ecoscore_data,labels,categories,packaging_tags,origins,brands`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as { status?: number; product?: OpenFoodFactsProduct & { brands?: string } };

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    const grade = product.ecoscore_grade?.toLowerCase();
    const points = grade ? (ECO_SCORE_POINTS[grade] ?? 5) : 5;
    const emoji = grade ? (ECO_SCORE_EMOJI[grade] ?? "🌿") : "🌿";

    const cats: string[] = [];
    if (product.labels?.toLowerCase().includes("bio") || product.labels?.toLowerCase().includes("organic")) cats.push("Bio");
    if (product.labels?.toLowerCase().includes("vegan")) cats.push("Vegano");
    if (product.labels?.toLowerCase().includes("fair")) cats.push("Equo Solidale");
    const category = cats[0] ?? (grade ? `Eco-Score ${grade.toUpperCase()}` : "Altro");

    const productName = product.product_name || `Prodotto ${normalizedBarcode}`;
    const reasoning = grade
      ? `Eco-Score ${grade.toUpperCase()} da Open Food Facts`
      : "Classificato da Open Food Facts";

    const result: BarcodeResult = {
      productName,
      ecoScore: grade ?? null,
      points,
      category,
      emoji,
      reasoning,
      source: "openfoodfacts",
    };

    const co2PerUnit = co2SavingsFromAgribalyse(product) ?? co2SavingsByCategory(category, points);
    await db.insert(productCacheTable).values({
      productNameNormalized: `barcode:${normalizedBarcode}`,
      productNameOriginal: productName,
      ecoScore: grade ?? null,
      points,
      category,
      source: "openfoodfacts",
      reasoning,
      emoji,
      co2PerUnit,
    }).onConflictDoNothing();

    return result;
  } catch {
    return null;
  }
}

interface BatchClassification {
  name: string;
  points: number;
  category: string;
  emoji: string;
  reasoning: string;
}

export async function classifyProductsBatch(productNames: string[]): Promise<FoundItem[]> {
  if (productNames.length === 0) return [];

  const results: FoundItem[] = [];
  const uncachedNames: string[] = [];
  const cachedMap = new Map<string, FoundItem | null>();

  for (const name of productNames) {
    const normalized = normalizeProductName(name);
    if (!normalized || normalized.length < 3) continue;

    const cached = await db
      .select()
      .from(productCacheTable)
      .where(eq(productCacheTable.productNameNormalized, normalized))
      .limit(1);

    if (cached.length > 0) {
      const entry = cached[0];
      cachedMap.set(name, entry.points > 0 ? {
        name: capitalizeProductName(entry.productNameOriginal || name),
        category: (entry.category || "Altro") as GreenCategory,
        points: entry.points,
        emoji: entry.emoji,
      } : null);
    } else {
      uncachedNames.push(name);
    }
  }

  for (const [, item] of cachedMap) {
    if (item) results.push(item);
  }

  if (uncachedNames.length === 0) return results;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Sei un esperto di sostenibilità. Classifica questi prodotti trovati su uno scontrino italiano.

Prodotti:
${uncachedNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Rispondi SOLO con un JSON array, uno per prodotto, nello stesso ordine:
[
  {"points": <0-20>, "category": <"Bio"|"Km 0"|"Vegano"|"Senza Plastica"|"Equo Solidale"|"DOP/IGP"|"Artigianale"|"Altro">, "emoji": <emoji>, "reasoning": <max 80 caratteri>},
  ...
]

Criteri punti:
- 0: prodotti non alimentari, prodotti ad alto impatto ambientale
- 5-8: prodotti alimentari standard senza certificazioni
- 10-14: frutta/verdura fresca, cereali, legumi, prodotti vegetali base
- 15-20: bio, vegano certificato, km 0, equo solidale, DOP/IGP`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const classifications = JSON.parse(jsonMatch[0]) as BatchClassification[];

    const savePromises: Promise<unknown>[] = [];

    for (let i = 0; i < uncachedNames.length; i++) {
      const name = uncachedNames[i];
      const cls = classifications[i];
      if (!cls) continue;

      const normalized = normalizeProductName(name);
      const points = Math.max(0, Math.min(20, cls.points ?? 0));
      const category = cls.category ?? "Altro";
      const emoji = cls.emoji ?? "🌿";
      const reasoning = cls.reasoning ?? "Classificato da AI";

      const capitalizedName = capitalizeProductName(name);
      savePromises.push(
        db.insert(productCacheTable).values({
          productNameNormalized: normalized,
          productNameOriginal: capitalizedName,
          ecoScore: null,
          points,
          category,
          source: "ai",
          reasoning,
          emoji,
          co2PerUnit: co2SavingsByCategory(category, points),
        }).onConflictDoNothing()
      );

      if (points > 0) {
        results.push({
          name: capitalizedName,
          category: category as GreenCategory,
          points,
          emoji,
        });
      }
    }

    await Promise.allSettled(savePromises);
  } catch (err) {
    console.error("[classifyProductsBatch]", err);
    for (const name of uncachedNames) {
      results.push({ name: capitalizeProductName(name), category: "Altro" as GreenCategory, points: 5, emoji: "🌿" });
    }
  }

  return results;
}

export interface ReceiptValidation {
  valid: boolean;
  complete: boolean;
  missingInfo: string[];
  store: string | null;
  date: string | null;
  totalCents: number | null;
  products: string[];
  reason: string;
}

export async function validateReceiptWithAI(imageBase64: string): Promise<ReceiptValidation> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Sei un lettore OCR preciso. Analizza questa immagine e determina se è uno scontrino (ricevuta/ticket di acquisto).

Rispondi SOLO con un JSON valido:
{
  "isReceipt": true/false,
  "complete": true/false,
  "missingInfo": ["data", "totale"],
  "store": "Nome Negozio" o null,
  "date": "YYYY-MM-DD" o null,
  "totalCents": 1250 o null,
  "products": [{"raw": "TESTO ORIGINALE SCONTRINO", "name": "Nome Normalizzato"}]
}

Regole:
- "isReceipt": true se l'immagine mostra uno scontrino/ricevuta fiscale
- "complete": true solo se riesci a leggere sia la data che il totale
- "missingInfo": lista degli elementi non leggibili tra ["data", "totale", "negozio"]. Array vuoto se tutto è leggibile
- "store": nome del negozio/supermercato se leggibile
- "date": data dello scontrino in formato YYYY-MM-DD. Se l'anno non è visibile, usa l'anno corrente (2026)
- "totalCents": importo totale in centesimi (es. €12.50 = 1250). null se non leggibile
- "products": array di oggetti con "raw" (testo ESATTO come appare sullo scontrino) e "name" (forma normalizzata leggibile). Massimo 15 prodotti.
  REGOLE FERREE per i prodotti:
  * Includi SOLO prodotti il cui nome è CHIARAMENTE e COMPLETAMENTE leggibile sulla foto
  * "raw" deve essere il testo letterale dallo scontrino, NON interpretato
  * "name" può normalizzare abbreviazioni INEQUIVOCABILI (es. "PAST PENNE 500G" → "Pasta Penne")
  * Se il testo è ambiguo, troncato, illeggibile o potrebbe essere più prodotti diversi: ESCLUDILO
  * NON dedurre, NON interpretare, NON inventare prodotti non esplicitamente scritti
  * Escludi: totali, subtotali, IVA, sconti, date, codici cassa, informazioni del negozio`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { valid: true, complete: false, missingInfo: [], store: null, date: null, totalCents: null, products: [], reason: "Risposta AI non parsabile" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      isReceipt?: boolean;
      complete?: boolean;
      missingInfo?: string[];
      store?: string | null;
      date?: string | null;
      totalCents?: number | null;
      products?: unknown[];
    };

    const products = (parsed.products ?? [])
      .flatMap((p): string[] => {
        if (typeof p === "string" && p.trim().length >= 2) {
          return [capitalizeProductName(p.trim())];
        }
        if (p && typeof p === "object") {
          const obj = p as Record<string, unknown>;
          const name = typeof obj.name === "string" ? obj.name.trim() : "";
          const raw = typeof obj.raw === "string" ? obj.raw.trim() : "";
          const preferred = raw.length >= 2 ? raw : name;
          if (preferred.length >= 2) {
            if (raw && name && raw !== name) {
              console.log(`[products] raw="${raw}" → name="${name}" → using raw`);
            }
            return [capitalizeProductName(preferred)];
          }
        }
        return [];
      })
      .slice(0, 15);

    const isValid = parsed.isReceipt === true;
    let extractedDate = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    if (extractedDate) {
      const parsed_d = new Date(extractedDate);
      const now = new Date();
      const diffDays = (now.getTime() - parsed_d.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 60) {
        const corrected = new Date(parsed_d);
        corrected.setFullYear(now.getFullYear());
        const correctedDiff = (now.getTime() - corrected.getTime()) / (1000 * 60 * 60 * 24);
        if (correctedDiff >= 0 && correctedDiff <= 60) {
          extractedDate = corrected.toISOString().slice(0, 10);
        }
      }
    }
    const extractedTotal = typeof parsed.totalCents === "number" ? Math.round(parsed.totalCents) : null;
    const extractedStore = typeof parsed.store === "string" && parsed.store.trim().length > 0 ? parsed.store.trim() : null;

    const missingInfo: string[] = [];
    if (!extractedDate) missingInfo.push("data");
    if (extractedTotal === null) missingInfo.push("totale");

    const isComplete = isValid && extractedDate !== null && extractedTotal !== null;

    let reason = "";
    if (!isValid) reason = "L'immagine non sembra uno scontrino.";
    else if (!isComplete) reason = `Informazioni mancanti: ${missingInfo.join(", ")}.`;
    else reason = "Scontrino valido e completo.";

    return {
      valid: isValid,
      complete: isComplete,
      missingInfo,
      store: extractedStore,
      date: extractedDate,
      totalCents: extractedTotal,
      products,
      reason,
    };
  } catch (err) {
    console.error("[validateReceiptWithAI]", err);
    return { valid: true, complete: false, missingInfo: [], store: null, date: null, totalCents: null, products: [], reason: "Errore AI, validazione non disponibile" };
  }
}

export async function analyzeReceiptWithAI(imageBase64: string): Promise<string[]> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Sei un assistente per la lettura di scontrini italiani. Analizza questa immagine di scontrino ed estrai i nomi dei prodotti acquistati.

Rispondi SOLO con un JSON array di stringhe con i nomi dei prodotti:
["prodotto 1", "prodotto 2", "prodotto 3"]

Regole:
- Includi TUTTI i prodotti (alimentari, per la casa, igienici, ecc.) — anche quelli convenzionali
- Escludi: totali, subtotali, IVA, sconti, date, informazioni del negozio, codici cassa
- Normalizza le abbreviazioni (es. "PAST PENNE 500G" → "Pasta Penne", "LATT INTERA" → "Latte Intero")
- Se l'immagine non è uno scontrino o non è leggibile, rispondi con []
- Massimo 15 prodotti`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];
    const products = JSON.parse(jsonMatch[0]) as unknown[];
    return products
      .filter((p): p is string => typeof p === "string" && p.trim().length >= 2)
      .slice(0, 15);
  } catch (err) {
    console.error("[analyzeReceiptWithAI]", err);
    return [];
  }
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

    const co2PerUnit = offProduct
      ? (co2SavingsFromAgribalyse(offProduct) ?? co2SavingsByCategory(classification.category, classification.points))
      : co2SavingsByCategory(classification.category, classification.points);
    await db.insert(productCacheTable).values({
      productNameNormalized: normalized,
      productNameOriginal: line,
      ecoScore: classification.ecoScore,
      points: classification.points,
      category: classification.category,
      source: offProduct ? "openfoodfacts" : "ai",
      reasoning: classification.reasoning,
      emoji: classification.emoji,
      co2PerUnit,
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
