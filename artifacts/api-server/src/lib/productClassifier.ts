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

const EAN_COUNTRY_PREFIXES: Array<[string, string]> = [
  ["800", "Italia"], ["801", "Italia"], ["802", "Italia"], ["803", "Italia"],
  ["804", "Italia"], ["805", "Italia"], ["806", "Italia"], ["807", "Italia"],
  ["808", "Italia"], ["809", "Italia"],
  ["400", "Germania"], ["401", "Germania"], ["402", "Germania"], ["403", "Germania"],
  ["404", "Germania"], ["405", "Germania"], ["406", "Germania"], ["407", "Germania"],
  ["408", "Germania"], ["409", "Germania"], ["410", "Germania"], ["411", "Germania"],
  ["412", "Germania"], ["413", "Germania"], ["414", "Germania"], ["415", "Germania"],
  ["416", "Germania"], ["417", "Germania"], ["418", "Germania"], ["419", "Germania"],
  ["300", "Francia"], ["301", "Francia"], ["302", "Francia"], ["303", "Francia"],
  ["304", "Francia"], ["305", "Francia"], ["306", "Francia"], ["307", "Francia"],
  ["308", "Francia"], ["309", "Francia"], ["310", "Francia"], ["311", "Francia"],
  ["312", "Francia"], ["313", "Francia"], ["314", "Francia"], ["315", "Francia"],
  ["316", "Francia"], ["317", "Francia"], ["318", "Francia"], ["319", "Francia"],
  ["320", "Francia"], ["321", "Francia"], ["322", "Francia"], ["323", "Francia"],
  ["324", "Francia"], ["325", "Francia"], ["326", "Francia"], ["327", "Francia"],
  ["328", "Francia"], ["329", "Francia"], ["330", "Francia"], ["331", "Francia"],
  ["332", "Francia"], ["333", "Francia"], ["334", "Francia"], ["335", "Francia"],
  ["336", "Francia"], ["337", "Francia"], ["338", "Francia"], ["339", "Francia"],
  ["340", "Francia"], ["341", "Francia"], ["342", "Francia"], ["343", "Francia"],
  ["344", "Francia"], ["345", "Francia"], ["346", "Francia"], ["347", "Francia"],
  ["348", "Francia"], ["349", "Francia"], ["350", "Francia"], ["351", "Francia"],
  ["352", "Francia"], ["353", "Francia"], ["354", "Francia"], ["355", "Francia"],
  ["356", "Francia"], ["357", "Francia"], ["358", "Francia"], ["359", "Francia"],
  ["360", "Francia"], ["361", "Francia"], ["362", "Francia"], ["363", "Francia"],
  ["364", "Francia"], ["365", "Francia"], ["366", "Francia"], ["367", "Francia"],
  ["368", "Francia"], ["369", "Francia"], ["370", "Francia"], ["371", "Francia"],
  ["372", "Francia"], ["373", "Francia"], ["374", "Francia"], ["375", "Francia"],
  ["376", "Francia"], ["377", "Francia"], ["378", "Francia"], ["379", "Francia"],
  ["840", "Spagna"], ["841", "Spagna"], ["842", "Spagna"], ["843", "Spagna"],
  ["844", "Spagna"], ["845", "Spagna"], ["846", "Spagna"], ["847", "Spagna"],
  ["848", "Spagna"], ["849", "Spagna"],
  ["500", "Regno Unito"], ["501", "Regno Unito"], ["502", "Regno Unito"], ["503", "Regno Unito"],
  ["504", "Regno Unito"], ["505", "Regno Unito"], ["506", "Regno Unito"], ["507", "Regno Unito"],
  ["508", "Regno Unito"], ["509", "Regno Unito"],
  ["00", "USA/Canada"], ["01", "USA/Canada"], ["02", "USA/Canada"], ["03", "USA/Canada"],
  ["04", "USA/Canada"], ["05", "USA/Canada"], ["06", "USA/Canada"], ["07", "USA/Canada"],
  ["08", "USA/Canada"], ["09", "USA/Canada"],
];

function getCountryFromBarcode(barcode: string): string | null {
  for (const [prefix, country] of EAN_COUNTRY_PREFIXES) {
    if (barcode.startsWith(prefix)) return country;
  }
  return null;
}

function isValidBarcode(barcode: string): boolean {
  if (!/^\d+$/.test(barcode)) return false;
  if (![8, 12, 13, 14].includes(barcode.length)) return false;
  if (barcode.length === 13 || barcode.length === 8) {
    let sum = 0;
    const digits = barcode.split("").map(Number);
    for (let i = 0; i < digits.length - 1; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[digits.length - 1];
  }
  return true;
}

function normalizeBarcode(barcode: string): string[] {
  const cleaned = barcode.replace(/[^0-9]/g, "");
  const variants: string[] = [cleaned];
  if (cleaned.length === 12) {
    variants.push("0" + cleaned);
  }
  if (cleaned.length === 14 && cleaned.startsWith("0")) {
    variants.push(cleaned.slice(1));
  }
  return [...new Set(variants)];
}

export { isValidBarcode };

async function classifyBarcodeWithAI(barcode: string): Promise<BarcodeResult> {
  const country = getCountryFromBarcode(barcode);
  const countryHint = country ? `\nIl prefisso del barcode indica produzione in: ${country}` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Sei un esperto di prodotti alimentari. Un utente ha scansionato un codice a barre EAN/UPC in un supermercato italiano ma il prodotto non è stato trovato nel database Open Food Facts.

Codice a barre: ${barcode}${countryHint}

Basandoti sulla struttura del codice a barre e sulla tua conoscenza dei prodotti alimentari, prova a identificare o stimare che tipo di prodotto potrebbe essere.

Rispondi SOLO con un JSON valido:
{
  "productName": <nome stimato del prodotto, o "Prodotto alimentare" se non identificabile>,
  "points": <numero 5-10, stima conservativa>,
  "category": <una di: "Bio", "Km 0", "Vegano", "Senza Plastica", "Equo Solidale", "DOP/IGP", "Artigianale", "Altro">,
  "emoji": <emoji appropriato>,
  "reasoning": <spiegazione breve in italiano max 80 caratteri>,
  "ecoScore": <"c" come default, o altra lettera se hai info sufficienti>
}

IMPORTANTE: Sii conservativo. Se non riesci a identificare il prodotto, usa "Prodotto alimentare" come nome, "Altro" come categoria, e 5 come punti.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      productName?: string;
      points?: number;
      category?: string;
      emoji?: string;
      reasoning?: string;
      ecoScore?: string;
    };

    return {
      productName: parsed.productName || `Prodotto ${barcode}`,
      ecoScore: parsed.ecoScore || null,
      points: Math.max(0, Math.min(15, parsed.points ?? 5)),
      category: parsed.category || "Altro",
      emoji: parsed.emoji || "🌿",
      reasoning: parsed.reasoning || "Classificato tramite AI",
      source: "ai",
    };
  } catch (err) {
    console.error("[classifyBarcodeWithAI]", err);
    return {
      productName: `Prodotto ${barcode}`,
      ecoScore: null,
      points: 5,
      category: "Altro",
      emoji: "🌿",
      reasoning: "Prodotto non trovato nei database — classificazione base",
      source: "ai-fallback",
    };
  }
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

  const barcodeVariants = normalizeBarcode(normalizedBarcode);

  for (const variant of barcodeVariants) {
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(variant)}.json?fields=product_name,ecoscore_grade,ecoscore_score,ecoscore_data,labels,categories,packaging_tags,origins,brands`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json() as { status?: number; product?: OpenFoodFactsProduct & { brands?: string } };

      if (data.status !== 1 || !data.product) continue;

      const product = data.product;
      const grade = product.ecoscore_grade?.toLowerCase();
      const validGrade = grade && grade !== "not-applicable" && grade !== "unknown" ? grade : null;
      const points = validGrade ? (ECO_SCORE_POINTS[validGrade] ?? 5) : 5;
      const emoji = validGrade ? (ECO_SCORE_EMOJI[validGrade] ?? "🌿") : "🌿";

      const cats: string[] = [];
      if (product.labels?.toLowerCase().includes("bio") || product.labels?.toLowerCase().includes("organic")) cats.push("Bio");
      if (product.labels?.toLowerCase().includes("vegan")) cats.push("Vegano");
      if (product.labels?.toLowerCase().includes("fair")) cats.push("Equo Solidale");
      const category = cats[0] ?? (validGrade ? `Eco-Score ${validGrade.toUpperCase()}` : "Altro");

      const brandPrefix = product.brands ? `${product.brands} - ` : "";
      const productName = product.product_name
        ? `${brandPrefix}${product.product_name}`
        : `Prodotto ${normalizedBarcode}`;
      const reasoning = validGrade
        ? `Eco-Score ${validGrade.toUpperCase()} da Open Food Facts`
        : "Classificato da Open Food Facts";

      const result: BarcodeResult = {
        productName,
        ecoScore: validGrade,
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
        ecoScore: validGrade,
        points,
        category,
        source: "openfoodfacts",
        reasoning,
        emoji,
        co2PerUnit,
      }).onConflictDoNothing();

      return result;
    } catch {
      continue;
    }
  }

  console.log(`[lookupBarcode] OFF miss for ${normalizedBarcode}, falling back to AI`);
  const aiResult = await classifyBarcodeWithAI(normalizedBarcode);

  const co2PerUnit = co2SavingsByCategory(aiResult.category, aiResult.points);
  await db.insert(productCacheTable).values({
    productNameNormalized: `barcode:${normalizedBarcode}`,
    productNameOriginal: aiResult.productName,
    ecoScore: aiResult.ecoScore,
    points: aiResult.points,
    category: aiResult.category,
    source: aiResult.source,
    reasoning: aiResult.reasoning,
    emoji: aiResult.emoji,
    co2PerUnit,
  }).onConflictDoNothing();

  return aiResult;
}

export interface BarcodeImageValidation {
  legitimate: boolean;
  confidence: number;
  reason: string;
}

export async function validateBarcodeImage(imageBase64: string): Promise<BarcodeImageValidation> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
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
              text: `Analizza questa immagine per determinare se mostra un PRODOTTO REALE con un codice a barre, oppure se è una FRODE (foto di uno schermo, screenshot, immagine stampata, foto di un altro telefono).

Rispondi SOLO con un JSON valido:
{
  "legitimate": true/false,
  "confidence": <0.0-1.0>,
  "reason": "<spiegazione breve in italiano, max 60 caratteri>"
}

Criteri di FRODE (legitimate=false):
- Pixel dello schermo visibili, effetto moiré
- Cornice/bordi di un telefono o monitor visibili
- Riflessi tipici di uno schermo LCD/OLED
- Immagine troppo piatta/uniforme (stampa su carta)
- Sfondo digitale o interfaccia app visibile
- Barre di stato, notifiche o UI di sistema visibili

Criteri di LEGITTIMITÀ (legitimate=true):
- Prodotto fisico 3D con ombre naturali
- Scaffale del supermercato, carrello, tavolo
- Illuminazione ambientale naturale/artificiale
- Profondità di campo reale
- Superficie/texture del packaging visibile`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { legitimate: true, confidence: 0.5, reason: "Validazione non disponibile" };

    const parsed = JSON.parse(jsonMatch[0]) as {
      legitimate?: boolean;
      confidence?: number;
      reason?: string;
    };

    return {
      legitimate: parsed.legitimate !== false,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reason: parsed.reason || "Analisi completata",
    };
  } catch (err) {
    console.error("[validateBarcodeImage]", err);
    return { legitimate: true, confidence: 0.5, reason: "Errore nella validazione immagine" };
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
  storeChain: string | null;
  province: string | null;
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
  "storeChain": "Nome Catena Normalizzato" o null,
  "province": "Nome Provincia" o null,
  "date": "YYYY-MM-DD" o null,
  "totalCents": 1250 o null,
  "products": [{"raw": "TESTO ORIGINALE SCONTRINO", "name": "Nome Normalizzato"}]
}

Regole:
- "isReceipt": true se l'immagine mostra uno scontrino/ricevuta fiscale
- "complete": true solo se riesci a leggere sia la data che il totale
- "missingInfo": lista degli elementi non leggibili tra ["data", "totale", "negozio"]. Array vuoto se tutto è leggibile
- "store": nome del negozio/supermercato ESATTO come appare sullo scontrino
- "storeChain": nome normalizzato della catena di appartenenza. Usa uno di questi nomi esatti se il negozio corrisponde:
  Standard: Esselunga, Coop, Ipercoop, UniCoop, NovaCoop, Conad, Conad City, Conad Superstore, Carrefour, Carrefour Express, Carrefour Market, Carrefour Iper, Pam, Panorama, Pam Local, Despar, Eurospar, Interspar, Spar, Bennet, Il Gigante, Tigros, Sigma, Crai, E.Leclerc, Famila, Tuodì, Cadoro, Dì per Dì, Prix Quality, Coal, A&O, Selex, Iper, Billa, Simply Market
  Bio/Naturale: NaturaSì, Bioessepiù, Ecor, Life, BioBottega
  Discount: Lidl, Aldi, Eurospin, Penny, Penny Market, MD Discount, In's Mercato, Ard Discount, Todis, Dok Discount
  Se il negozio non corrisponde a nessuna di queste catene, usa comunque il nome del negozio
- "province": provincia italiana del punto vendita, dedotta dall'indirizzo sullo scontrino (es. "Milano", "Roma", "Torino", "Novara"). Usa il nome della provincia, NON del comune. null se non determinabile
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
      return { valid: true, complete: false, missingInfo: [], store: null, storeChain: null, province: null, date: null, totalCents: null, products: [], reason: "Risposta AI non parsabile" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      isReceipt?: boolean;
      complete?: boolean;
      missingInfo?: string[];
      store?: string | null;
      storeChain?: string | null;
      province?: string | null;
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
    const extractedStoreChain = typeof parsed.storeChain === "string" && parsed.storeChain.trim().length > 0 ? parsed.storeChain.trim() : null;
    const extractedProvince = typeof parsed.province === "string" && parsed.province.trim().length > 0 ? parsed.province.trim() : null;

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
      storeChain: extractedStoreChain,
      province: extractedProvince,
      date: extractedDate,
      totalCents: extractedTotal,
      products,
      reason,
    };
  } catch (err) {
    console.error("[validateReceiptWithAI]", err);
    return { valid: true, complete: false, missingInfo: [], store: null, storeChain: null, province: null, date: null, totalCents: null, products: [], reason: "Errore AI, validazione non disponibile" };
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
