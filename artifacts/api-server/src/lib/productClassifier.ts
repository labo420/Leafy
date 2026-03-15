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

const ECO_HERO_MAX_POINTS = 40;
const ECO_HERO_KEYWORDS = [
  "sfuso", "sfuse", "sfusi",
  "km 0", "km0", "km zero", "chilometro zero",
  "fair trade", "fairtrade", "equo solidale", "equosolidale",
  "ricaricabile", "ricaricabili",
  "zero plastica", "plastic free", "plastic-free", "senza plastica",
  "senza imballaggi", "zero imballaggi",
  "vegano certificato", "vegan certified",
];

function applyEcoHeroMultiplier(points: number, productName: string, category: string, reasoning: string): { points: number; isEcoHero: boolean } {
  const haystack = `${productName} ${category} ${reasoning}`.toLowerCase();
  const isEcoHero = ECO_HERO_KEYWORDS.some((kw) => haystack.includes(kw));
  if (isEcoHero && points >= 10) {
    return { points: Math.min(ECO_HERO_MAX_POINTS, points * 2), isEcoHero: true };
  }
  return { points, isEcoHero: false };
}

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

function resolveProductEmoji(productName: string, category: string, aiEmoji: string): string {
  const name = productName.toLowerCase();

  const keywordMap: Array<[string[], string]> = [
    [["mozzarella", "ricotta", "mascarpone", "brie", "camembert", "fontina", "asiago", "provolone", "grana", "parmigian", "pecorino", "fetta", "formaggio"], "🧀"],
    [["burro", "margarina"], "🧈"],
    [["yogurt", "yoghurt"], "🥛"],
    [["latte", "latticin", "panna"], "🥛"],
    [["uova", "uovo"], "🥚"],
    [["salame", "prosciutto", "mortadella", "bresaola", "speck", "pancetta", "coppa", "guanciale", "salumi"], "🥩"],
    [["pollo", "tacchino", "petto di pollo"], "🍗"],
    [["salsiccia", "wurstel", "würstel", "cotechino"], "🌭"],
    [["maiale", "suino", "bistecca", "manzo", "vitello", "agnello", "carne", "hamburger", "burger"], "🥩"],
    [["salmone", "tonno", "baccalà", "merluzzo", "branzino", "orata", "sgombro", "acciuga", "sardina", "pesce"], "🐟"],
    [["gambero", "cozza", "vongola", "polpo", "calamaro", "surimi", "frutti di mare"], "🦐"],
    [["pasta", "spaghetti", "penne", "rigatoni", "fusilli", "lasagne", "maccheroni", "tagliatelle", "linguine", "bucatini", "farfalle", "orecchiette", "gnocchi", "tortellini", "ravioli"], "🍝"],
    [["pizza", "calzone"], "🍕"],
    [["pane", "pancarré", "focaccia", "grissini", "taralli", "brioche", "cornetto", "ciabatta", "baguette", "panino"], "🍞"],
    [["riso", "risotto", "arborio"], "🍚"],
    [["farina", "semola", "fecola", "amido"], "🌾"],
    [["cereali", "muesli", "fiocchi d'avena", "cornflakes", "granola"], "🥣"],
    [["banana", "banane"], "🍌"],
    [["arancia", "arance", "mandarino", "clementina"], "🍊"],
    [["limone", "limoni", "lime"], "🍋"],
    [["mela", "mele", "golden", "fuji", "granny smith"], "🍎"],
    [["pera", "pere", "conference"], "🍐"],
    [["uva", "uvetta"], "🍇"],
    [["anguria", "cocomero"], "🍉"],
    [["fragola", "lampone", "mirtillo", "mora"], "🍓"],
    [["ciliegia", "ciliegie"], "🍒"],
    [["pesca", "pesche", "albicocca", "nettarina"], "🍑"],
    [["kiwi"], "🥝"],
    [["avocado"], "🥑"],
    [["ananas", "mango", "papaya"], "🍍"],
    [["melon", "melone", "cantalupo"], "🍈"],
    [["pomodoro", "pomodori", "passata", "pelati", "pachino"], "🍅"],
    [["mais", "grano turco"], "🌽"],
    [["patata", "patate", "patatine", "chips"], "🥔"],
    [["carota", "carote"], "🥕"],
    [["melanzana", "melanzane"], "🍆"],
    [["peperone", "peperoni", "peperoncino"], "🫑"],
    [["broccoli", "cavolfiore", "cavolo", "verza", "cavolini"], "🥦"],
    [["cipolla", "cipolle", "scalogno"], "🧅"],
    [["aglio"], "🧄"],
    [["fungo", "funghi", "champignon", "porcini"], "🍄"],
    [["insalata", "lattuga", "rucola", "spinaci", "bietola", "radicchio", "misticanza"], "🥗"],
    [["zucchina", "zucchine", "zucchini", "cetriolo", "cetrioli"], "🥒"],
    [["fagioli", "lenticchie", "ceci", "piselli", "soia", "legumi"], "🫘"],
    [["olio", "oliva", "olive"], "🫒"],
    [["miele"], "🍯"],
    [["zucchero", "saccarosio", "fruttosio"], "🍚"],
    [["sale", "salgemma"], "🧂"],
    [["spezie", "pepe", "cannella", "curcuma", "paprika", "zafferano", "origano", "basilico", "rosmarino"], "🌿"],
    [["salsa", "ketchup", "maionese", "senape", "pesto", "ragù", "sugo"], "🧂"],
    [["aceto", "balsamico"], "🫙"],
    [["caffè", "espresso", "capsule", "cialde", "nescafé", "coffee"], "☕"],
    [["tè", "tea", "camomilla", "tisana", "infuso", "erboristeria"], "🍵"],
    [["acqua", "water", "minerale"], "💧"],
    [["succo", "juice", "nettare", "smoothie", "centrifugato"], "🧃"],
    [["vino", "wine", "rosso doc", "bianco doc", "prosecco", "spumante", "champagne", "lambrusco"], "🍷"],
    [["birra", "beer", "lager", "pilsner", "ipa", "ale"], "🍺"],
    [["bibita", "cola", "fanta", "sprite", "aranciata", "limonata", "soda", "energy drink"], "🥤"],
    [["cioccolato", "cacao", "gianduia", "nutella", "crema spalmabile", "fondente"], "🍫"],
    [["biscotti", "wafer", "crackers", "gallette", "frollini"], "🍪"],
    [["torta", "cake", "merendine", "plumcake", "pan di spagna", "crostata", "crostatina"], "🍰"],
    [["gelato", "ghiacciolo", "sorbetto"], "🍦"],
    [["caramelle", "gomme da masticare", "bonbon", "lollipop", "gommose"], "🍬"],
    [["popcorn", "nachos", "pretzel", "snack"], "🍿"],
    [["detersivo", "detergente", "candeggina", "ammorbidente", "lavatrice", "lavastoviglie"], "🧼"],
    [["sapone", "shampoo", "balsamo", "doccia", "bagnoschiuma", "igiene"], "🧴"],
    [["dentifricio", "spazzolino", "collutorio"], "🪥"],
    [["carta", "scottex", "tovaglioli", "fazzoletti", "rotoli"], "🧻"],
    [["pannolini", "pampers", "neonato", "bebè"], "👶"],
  ];

  for (const [keywords, emoji] of keywordMap) {
    if (keywords.some(kw => name.includes(kw))) return emoji;
  }

  const categoryMap: Record<string, string> = {
    "Bio": "🌿",
    "Vegano": "🌱",
    "Km 0": "📍",
    "DOP/IGP": "🏆",
    "Equo Solidale": "🤝",
    "Artigianale": "👨‍🍳",
    "Senza Plastica": "♻️",
  };
  if (category && categoryMap[category]) return categoryMap[category];

  const badEmojis = ["🛒", "🏪", "💰", "💵", "🧾", "📝", "📦", "❓"];
  if (aiEmoji && !badEmojis.includes(aiEmoji)) return aiEmoji;

  return "🌿";
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

const GS1_ITALY_PREFIXES: Array<[string, string]> = [
  ["8000430", "Mondelez Italia (Fonzies, TUC, Oreo, Chips Ahoy)"],
  ["8000226", "Kraft Heinz Italia"],
  ["8000040", "Unilever Italia (Algida, Cif, Dove)"],
  ["8001620", "Nestlé Italia (Motta, Buitoni, Nescafé)"],
  ["8001791", "Barilla (Barilla, Mulino Bianco, Pavesi)"],
  ["8000849", "Ferrero (Nutella, Kinder, Raffaello, Rocher)"],
  ["8000970", "Barilla / Mulino Bianco"],
  ["8001120", "Divella"],
  ["8001230", "Giovanni Rana (pasta fresca)"],
  ["8003540", "Findus / Birds Eye Italia"],
  ["8004610", "Lavazza"],
  ["8003180", "illycaffè"],
  ["8007340", "San Carlo Snack"],
  ["8007530", "Saclà"],
  ["8006120", "De Cecco"],
  ["8007570", "Granarolo"],
  ["8008480", "Mutti (pomodori)"],
  ["8000790", "Coop Italia"],
  ["8000570", "Parmalat (latte, yogurt)"],
  ["8001800", "Danone Italia"],
  ["8001590", "Colussi / Gran Turchese"],
  ["8005110", "Star (Star, Pummarò)"],
  ["8005310", "Callipo"],
  ["8003660", "Zuegg"],
  ["8001490", "Fiat / Agnesi pasta"],
  ["8000920", "Acqua Minerale San Benedetto"],
  ["8000280", "Ferrarelle"],
  ["8001940", "Acqua Levissima / San Pellegrino"],
  ["8004480", "Lurpak / Arla Italia"],
  ["8004500", "Philadelphia / Kraft"],
  ["8007940", "Surgital"],
  ["8003510", "Orogel"],
  ["8005700", "Arrigoni"],
  ["8007140", "Forno d'Asolo"],
  ["8007480", "Tre Marie"],
  ["8001050", "Galbani / Lactalis Italia"],
  ["8007430", "Sterilgarda"],
  ["8001000", "Zara / Oleifici Zara"],
  ["8000810", "Lidl Italia"],
  ["8000600", "Esselunga (marca propria)"],
  ["8007810", "Despar Italia"],
  ["8007680", "Conad (marca propria)"],
];

function getItalianBrandHint(barcode: string): string | null {
  if (!isItalianBarcode(barcode)) return null;
  for (const [prefix, brand] of GS1_ITALY_PREFIXES) {
    if (barcode.startsWith(prefix)) return brand;
  }
  return null;
}

interface ExternalProductResult {
  productName: string;
  brand?: string;
  categories?: string;
}

async function lookupNutritionix(barcode: string): Promise<ExternalProductResult | null> {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const apiKey = process.env.NUTRITIONIX_API_KEY;
  if (!appId || !apiKey) return null;

  try {
    const res = await fetch(`https://trackapi.nutritionix.com/v2/search/item/?upc=${barcode}`, {
      headers: {
        "x-app-id": appId,
        "x-app-key": apiKey,
        "x-remote-user-id": "0",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { foods?: Array<{ food_name?: string; brand_name?: string; nf_ingredient_statement?: string }> };
    const item = data.foods?.[0];
    if (!item?.food_name) return null;
    console.log(`[lookupNutritionix] Found "${item.food_name}" for ${barcode}`);
    return {
      productName: item.food_name,
      brand: item.brand_name,
    };
  } catch (err) {
    console.log(`[lookupNutritionix] Error for ${barcode}:`, (err as Error).message);
    return null;
  }
}

async function lookupUSDA(barcode: string): Promise<ExternalProductResult | null> {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&api_key=${apiKey}&pageSize=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as { foods?: Array<{ description?: string; brandOwner?: string; foodCategory?: string; gtinUpc?: string }> };
    const item = data.foods?.find(f => f.gtinUpc === barcode || f.gtinUpc === barcode.replace(/^0+/, ""));
    if (!item?.description) return null;
    console.log(`[lookupUSDA] Found "${item.description}" for ${barcode}`);
    return {
      productName: item.description,
      brand: item.brandOwner,
      categories: item.foodCategory,
    };
  } catch (err) {
    console.log(`[lookupUSDA] Error for ${barcode}:`, (err as Error).message);
    return null;
  }
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

function isItalianBarcode(barcode: string): boolean {
  const prefix = barcode.slice(0, 3);
  const num = parseInt(prefix, 10);
  return num >= 800 && num <= 809;
}

async function classifyWithProductData(
  barcode: string,
  name: string,
  brand: string,
  categories: string,
  labels: string,
): Promise<BarcodeResult> {
  const country = getCountryFromBarcode(barcode);
  const countryHint = country ? `\nPaese di origine (dal barcode): ${country}` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Sei un esperto di sostenibilità ambientale e prodotti alimentari. Un prodotto è stato trovato su Open Food Facts ma senza un eco-score calcolato. Usa i metadati disponibili per stimare il suo impatto ambientale.

Nome prodotto: ${name}
Brand: ${brand || "non disponibile"}
Categorie: ${categories || "non disponibili"}
Etichette: ${labels || "non disponibili"}
Codice a barre: ${barcode}${countryHint}

Rispondi SOLO con un JSON valido:
{
  "points": <numero 0-20, dove 0=non sostenibile, 20=eccellente>,
  "category": <una di: "Bio", "Km 0", "Vegano", "Senza Plastica", "Equo Solidale", "DOP/IGP", "Artigianale", "Altro">,
  "emoji": <emoji appropriato>,
  "reasoning": <spiegazione breve in italiano max 80 caratteri>,
  "ecoScore": <lettera a-e basata sulla tua analisi dei metadati>
}

LINEE GUIDA per la stima eco-score:
- Latticini lavorati, carni processate → d o e
- Prodotti freschi, frutta, verdura → a o b
- Prodotti confezionati standard → c
- Bio/organic/vegano → migliorare di un grado
- Usa le categorie e le etichette per una stima più precisa`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      points?: number;
      category?: string;
      emoji?: string;
      reasoning?: string;
      ecoScore?: string;
    };

    const brandPrefix = brand ? `${brand} - ` : "";
    const productName = name ? `${brandPrefix}${name}` : `Prodotto ${barcode}`;
    const category = parsed.category || "Altro";

    return {
      productName,
      ecoScore: parsed.ecoScore || null,
      points: Math.max(0, Math.min(20, parsed.points ?? 5)),
      category,
      emoji: resolveProductEmoji(productName, category, parsed.emoji || "🌿"),
      reasoning: parsed.reasoning || "Classificato con dati Open Food Facts + AI",
      source: "openfoodfacts-ai",
    };
  } catch (err) {
    console.error("[classifyWithProductData]", err);
    const brandPrefix = brand ? `${brand} - ` : "";
    const productName = name ? `${brandPrefix}${name}` : `Prodotto ${barcode}`;
    return {
      productName,
      ecoScore: null,
      points: 5,
      category: "Altro",
      emoji: resolveProductEmoji(productName, "Altro", "🌿"),
      reasoning: "Classificato da Open Food Facts",
      source: "openfoodfacts",
    };
  }
}

async function classifyWithVision(barcode: string, imageBase64: string): Promise<BarcodeResult | null> {
  const country = getCountryFromBarcode(barcode);
  const countryHint = country ? `\nIl prefisso del barcode indica produzione in: ${country}` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
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
              text: `Sei un esperto di prodotti alimentari e sostenibilità. L'utente ha scansionato questo prodotto in un supermercato italiano ma non è stato trovato nel database Open Food Facts.

Codice a barre: ${barcode}${countryHint}

Analizza la foto della confezione del prodotto. Cerca di leggere:
- Nome del prodotto
- Brand/marca
- Ingredienti visibili
- Certificazioni (Bio, DOP, IGP, Vegano, Fair Trade, ecc.)
- Tipo di confezione (plastica, vetro, cartone, ecc.)

Rispondi SOLO con un JSON valido:
{
  "productName": <nome del prodotto letto dalla confezione, o "Prodotto alimentare" se non leggibile>,
  "brand": <marca se visibile>,
  "points": <numero 0-20, stima basata su ciò che vedi>,
  "category": <una di: "Bio", "Km 0", "Vegano", "Senza Plastica", "Equo Solidale", "DOP/IGP", "Artigianale", "Altro">,
  "emoji": <emoji appropriato>,
  "reasoning": <spiegazione breve in italiano max 80 caratteri>,
  "ecoScore": <lettera a-e basata sulla tua analisi visiva>
}`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      productName?: string;
      brand?: string;
      points?: number;
      category?: string;
      emoji?: string;
      reasoning?: string;
      ecoScore?: string;
    };

    const brandPrefix = parsed.brand ? `${parsed.brand} - ` : "";
    const productName = parsed.productName && parsed.productName !== "Prodotto alimentare"
      ? `${brandPrefix}${parsed.productName}`
      : `Prodotto ${barcode}`;
    const category = parsed.category || "Altro";

    return {
      productName,
      ecoScore: parsed.ecoScore || null,
      points: Math.max(0, Math.min(20, parsed.points ?? 5)),
      category,
      emoji: resolveProductEmoji(productName, category, parsed.emoji || "🌿"),
      reasoning: parsed.reasoning || "Classificato tramite analisi visiva",
      source: "vision",
    };
  } catch (err) {
    console.error("[classifyWithVision]", err);
    return null;
  }
}

async function classifyBarcodeWithAI(barcode: string, brandHint?: string): Promise<BarcodeResult> {
  const country = getCountryFromBarcode(barcode);
  const countryHint = country ? `\nIl prefisso del barcode indica produzione in: ${country}` : "";
  const brandLine = brandHint ? `\nProduttore identificato dal prefisso GS1: ${brandHint}` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Sei un esperto di prodotti alimentari. Un utente ha scansionato un codice a barre EAN/UPC in un supermercato italiano ma il prodotto non è stato trovato nel database Open Food Facts.

Codice a barre: ${barcode}${countryHint}${brandLine}

Basandoti sulla struttura del codice a barre, sul produttore identificato (se disponibile) e sulla tua conoscenza dei prodotti alimentari, prova a identificare o stimare che tipo di prodotto potrebbe essere.

Rispondi SOLO con un JSON valido:
{
  "productName": <nome stimato del prodotto includendo il brand se noto, o "Prodotto alimentare" se non identificabile>,
  "points": <numero 5-10, stima conservativa>,
  "category": <una di: "Bio", "Km 0", "Vegano", "Senza Plastica", "Equo Solidale", "DOP/IGP", "Artigianale", "Altro">,
  "emoji": <emoji appropriato>,
  "reasoning": <spiegazione breve in italiano max 80 caratteri>,
  "ecoScore": <"c" come default, o altra lettera se hai info sufficienti>
}

IMPORTANTE: Se il produttore è fornito, usalo nel nome prodotto (es. "Mondelez - Snack" invece di "Prodotto alimentare"). Sii comunque conservativo sui punti.`,
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

    const productName = parsed.productName || `Prodotto ${barcode}`;
    const category = parsed.category || "Altro";
    return {
      productName,
      ecoScore: parsed.ecoScore || null,
      points: Math.max(0, Math.min(15, parsed.points ?? 5)),
      category,
      emoji: resolveProductEmoji(productName, category, parsed.emoji || "🌿"),
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

export async function classifyManualProduct(
  barcode: string,
  name: string,
  weightValue: number,
  weightUnit: "g" | "kg",
  frontImageBase64?: string,
  backImageBase64?: string,
): Promise<BarcodeResult> {
  const weightGrams = weightUnit === "kg" ? weightValue * 1000 : weightValue;
  const weightText = weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(2)} kg` : `${weightGrams} g`;

  try {
    const images: Array<{ type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }> = [];
    if (frontImageBase64) {
      images.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: frontImageBase64 } });
    }
    if (backImageBase64) {
      images.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: backImageBase64 } });
    }

    const textPrompt = `Sei un esperto di prodotti alimentari e sostenibilità. Un utente ha inserito manualmente questo prodotto perché non è stato trovato nei database automatici.

Nome inserito dall'utente: ${name}
Peso/Quantità: ${weightText}
Codice a barre: ${barcode}
${images.length > 0 ? `Foto confezione: ${images.length} immagine/i allegate — analizzale attentamente per confermare o correggere il nome.` : "Nessuna foto fornita."}

Rispondi SOLO con un JSON valido:
{
  "productName": <nome corretto del prodotto, preferisci quello letto dalla confezione se visibile, altrimenti usa esattamente "${name}">,
  "brand": <marca se visibile nella confezione o nel nome, null altrimenti>,
  "points": <numero 0-20>,
  "category": <una di: "Bio", "Km 0", "Vegano", "Senza Plastica", "Equo Solidale", "DOP/IGP", "Artigianale", "Altro">,
  "emoji": <emoji appropriato al prodotto specifico>,
  "reasoning": <spiegazione breve in italiano max 80 caratteri>,
  "ecoScore": <lettera a-e basata su tipo prodotto e certificazioni visibili>
}`;

    const content: Array<{ type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } } | { type: "text"; text: string }> = [
      ...images,
      { type: "text", text: textPrompt },
    ];

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      productName?: string;
      brand?: string;
      points?: number;
      category?: string;
      emoji?: string;
      reasoning?: string;
      ecoScore?: string;
    };

    const brandPrefix = parsed.brand ? `${parsed.brand} - ` : "";
    const productName = parsed.productName ? `${brandPrefix}${parsed.productName}` : name;
    const category = parsed.category || "Altro";

    return {
      productName,
      ecoScore: parsed.ecoScore || null,
      points: Math.max(0, Math.min(20, parsed.points ?? 5)),
      category,
      emoji: resolveProductEmoji(productName, category, parsed.emoji || "🌿"),
      reasoning: parsed.reasoning || "Inserito e classificato manualmente",
      source: "manual",
    };
  } catch (err) {
    console.error("[classifyManualProduct]", err);
    return {
      productName: name,
      ecoScore: null,
      points: 5,
      category: "Altro",
      emoji: resolveProductEmoji(name, "Altro", "🌿"),
      reasoning: "Inserito manualmente",
      source: "manual",
    };
  }
}

async function fetchFromOFF(
  variant: string,
  endpoint: string,
): Promise<{ status?: number; product?: OpenFoodFactsProduct & { brands?: string } } | null> {
  try {
    const url = `https://${endpoint}/api/v0/product/${encodeURIComponent(variant)}.json?fields=product_name,ecoscore_grade,ecoscore_score,ecoscore_data,labels,categories,packaging_tags,origins,brands`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as { status?: number; product?: OpenFoodFactsProduct & { brands?: string } };
  } catch {
    return null;
  }
}

export async function lookupBarcode(barcode: string, imageBase64?: string): Promise<BarcodeResult | null> {
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
  const useItalianFirst = isItalianBarcode(normalizedBarcode);
  const endpoints = useItalianFirst
    ? ["it.openfoodfacts.org", "world.openfoodfacts.org"]
    : ["world.openfoodfacts.org"];

  for (const variant of barcodeVariants) {
    for (const endpoint of endpoints) {
      const data = await fetchFromOFF(variant, endpoint);
      if (!data || data.status !== 1 || !data.product) continue;

      const product = data.product;
      const grade = product.ecoscore_grade?.toLowerCase();
      const validGrade = grade && grade !== "not-applicable" && grade !== "unknown" ? grade : null;

      if (!validGrade && product.product_name) {
        console.log(`[lookupBarcode] OFF found "${product.product_name}" on ${endpoint} without eco-score, classifying with AI`);
        const aiResult = await classifyWithProductData(
          normalizedBarcode,
          product.product_name || "",
          product.brands || "",
          product.categories || "",
          product.labels || "",
        );

        const co2PerUnit = co2SavingsFromAgribalyse(product) ?? co2SavingsByCategory(aiResult.category, aiResult.points);
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

      let points = validGrade ? (ECO_SCORE_POINTS[validGrade] ?? 5) : 5;
      const ecoEmoji = validGrade ? (ECO_SCORE_EMOJI[validGrade] ?? "🌿") : "🌿";

      const cats: string[] = [];
      if (product.labels?.toLowerCase().includes("bio") || product.labels?.toLowerCase().includes("organic")) cats.push("Bio");
      if (product.labels?.toLowerCase().includes("vegan")) cats.push("Vegano");
      if (product.labels?.toLowerCase().includes("fair")) cats.push("Equo Solidale");
      const category = cats[0] ?? (validGrade ? `Eco-Score ${validGrade.toUpperCase()}` : "Altro");

      const brandPrefix = product.brands ? `${product.brands} - ` : "";
      const productName = product.product_name
        ? `${brandPrefix}${product.product_name}`
        : `Prodotto ${normalizedBarcode}`;
      const reasoningRaw = validGrade
        ? `Eco-Score ${validGrade.toUpperCase()} da Open Food Facts`
        : "Classificato da Open Food Facts";

      const heroCheck = applyEcoHeroMultiplier(points, productName, category, reasoningRaw);
      points = heroCheck.points;
      const reasoning = heroCheck.isEcoHero ? `${reasoningRaw} · Eco-Hero ⭐` : reasoningRaw;
      const emoji = resolveProductEmoji(productName, category, ecoEmoji);

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
    }
  }

  const brandHint = getItalianBrandHint(normalizedBarcode);

  const nutritionixResult = await lookupNutritionix(normalizedBarcode);
  if (nutritionixResult) {
    const aiResult = await classifyWithProductData(
      normalizedBarcode,
      nutritionixResult.productName,
      nutritionixResult.brand ?? "",
      nutritionixResult.categories ?? "",
      "",
    );
    const heroCheck = applyEcoHeroMultiplier(aiResult.points, aiResult.productName, aiResult.category, aiResult.reasoning);
    const finalResult = heroCheck.isEcoHero
      ? { ...aiResult, points: heroCheck.points, reasoning: `${aiResult.reasoning} · Eco-Hero ⭐`, source: "nutritionix" as const }
      : { ...aiResult, source: "nutritionix" as const };
    const co2PerUnit = co2SavingsByCategory(finalResult.category, finalResult.points);
    await db.insert(productCacheTable).values({
      productNameNormalized: `barcode:${normalizedBarcode}`,
      productNameOriginal: finalResult.productName,
      ecoScore: finalResult.ecoScore,
      points: finalResult.points,
      category: finalResult.category,
      source: finalResult.source,
      reasoning: finalResult.reasoning,
      emoji: finalResult.emoji,
      co2PerUnit,
    }).onConflictDoNothing();
    return finalResult;
  }

  const usdaResult = await lookupUSDA(normalizedBarcode);
  if (usdaResult) {
    const aiResult = await classifyWithProductData(
      normalizedBarcode,
      usdaResult.productName,
      usdaResult.brand ?? "",
      usdaResult.categories ?? "",
      "",
    );
    const heroCheck = applyEcoHeroMultiplier(aiResult.points, aiResult.productName, aiResult.category, aiResult.reasoning);
    const finalResult = heroCheck.isEcoHero
      ? { ...aiResult, points: heroCheck.points, reasoning: `${aiResult.reasoning} · Eco-Hero ⭐`, source: "usda" as const }
      : { ...aiResult, source: "usda" as const };
    const co2PerUnit = co2SavingsByCategory(finalResult.category, finalResult.points);
    await db.insert(productCacheTable).values({
      productNameNormalized: `barcode:${normalizedBarcode}`,
      productNameOriginal: finalResult.productName,
      ecoScore: finalResult.ecoScore,
      points: finalResult.points,
      category: finalResult.category,
      source: finalResult.source,
      reasoning: finalResult.reasoning,
      emoji: finalResult.emoji,
      co2PerUnit,
    }).onConflictDoNothing();
    return finalResult;
  }

  if (imageBase64 && typeof imageBase64 === "string" && imageBase64.length > 100) {
    console.log(`[lookupBarcode] OFF miss for ${normalizedBarcode}, trying vision fallback`);
    const visionResult = await classifyWithVision(normalizedBarcode, imageBase64);
    if (visionResult) {
      const heroCheck = applyEcoHeroMultiplier(visionResult.points, visionResult.productName, visionResult.category, visionResult.reasoning);
      const finalResult = heroCheck.isEcoHero
        ? { ...visionResult, points: heroCheck.points, reasoning: `${visionResult.reasoning} · Eco-Hero ⭐` }
        : visionResult;
      const co2PerUnit = co2SavingsByCategory(finalResult.category, finalResult.points);
      await db.insert(productCacheTable).values({
        productNameNormalized: `barcode:${normalizedBarcode}`,
        productNameOriginal: finalResult.productName,
        ecoScore: finalResult.ecoScore,
        points: finalResult.points,
        category: finalResult.category,
        source: finalResult.source,
        reasoning: finalResult.reasoning,
        emoji: finalResult.emoji,
        co2PerUnit,
      }).onConflictDoNothing();

      return finalResult;
    }
  }

  if (brandHint) {
    console.log(`[lookupBarcode] GS1 brand hint for ${normalizedBarcode}: ${brandHint}`);
  }
  console.log(`[lookupBarcode] All sources miss for ${normalizedBarcode}, falling back to AI${brandHint ? " with brand hint" : ""}`);
  const aiResult = await classifyBarcodeWithAI(normalizedBarcode, brandHint ?? undefined);

  const heroCheck = applyEcoHeroMultiplier(aiResult.points, aiResult.productName, aiResult.category, aiResult.reasoning);
  const finalAiResult = heroCheck.isEcoHero
    ? { ...aiResult, points: heroCheck.points, reasoning: `${aiResult.reasoning} · Eco-Hero ⭐` }
    : aiResult;

  const co2PerUnit = co2SavingsByCategory(finalAiResult.category, finalAiResult.points);
  await db.insert(productCacheTable).values({
    productNameNormalized: `barcode:${normalizedBarcode}`,
    productNameOriginal: finalAiResult.productName,
    ecoScore: finalAiResult.ecoScore,
    points: finalAiResult.points,
    category: finalAiResult.category,
    source: finalAiResult.source,
    reasoning: finalAiResult.reasoning,
    emoji: finalAiResult.emoji,
    co2PerUnit,
  }).onConflictDoNothing();

  return finalAiResult;
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
      const capitalizedName = capitalizeProductName(name);
      const emoji = resolveProductEmoji(capitalizedName, category, cls.emoji ?? "🌿");
      const reasoning = cls.reasoning ?? "Classificato da AI";
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
    const currentYear = new Date().getFullYear();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1800,
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
              text: `Sei un esperto OCR specializzato in scontrini italiani. Analizza questa immagine e determina se è uno scontrino o ricevuta di acquisto.

TIPI DI DOCUMENTO VALIDI (tutti equivalenti in Italia):
- Scontrino fiscale / ricevuta fiscale
- Documento Commerciale (ha sostituito la ricevuta fiscale dal 2020 per legge italiana)
- Ricevuta generica di acquisto
- Ticket di cassa

Rispondi SOLO con un JSON valido, senza altro testo:
{
  "isReceipt": true/false,
  "complete": true/false,
  "missingInfo": [],
  "store": "Nome Negozio esatto" o null,
  "storeChain": "Nome Catena" o null,
  "province": "Nome Provincia" o null,
  "date": "YYYY-MM-DD" o null,
  "totalCents": 1250 o null,
  "products": [{"raw": "TESTO ORIGINALE", "name": "Nome Normalizzato"}]
}

=== REGOLE DATA ===
Gli scontrini italiani usano questi formati (convertili SEMPRE in YYYY-MM-DD):
- GG/MM/AA → es. "15/03/26" = "${currentYear}-03-15"
- GG/MM/AAAA → es. "15/03/2026" = "2026-03-15"
- GG.MM.AAAA → es. "15.03.2026" = "2026-03-15"
- GG-MM-AAAA → es. "15-03-2026" = "2026-03-15"
- GG MM AAAA → es. "15 03 2026" = "2026-03-15"
Se l'anno ha 2 cifre, anteponi "20" (es. 26 → 2026).
Se l'anno non appare sullo scontrino, usa ${currentYear}.
La data può comparire vicino a: ORA, CASSA, OP., DATA, emissione.

=== REGOLE TOTALE ===
Cerca queste etichette (nell'ordine, prendi la prima trovata):
TOTALE COMPLESSIVO, TOTALE, TOT. COMPLESSIVO, TOT, IMPORTO, DA PAGARE, PAGATO, AMOUNT, TOTALE EURO
Il totale è l'importo finale pagato. Convertilo in centesimi interi (€4,19 = 419, €12.50 = 1250).
Nota: il separatore decimale italiano è la virgola (,) o il punto (.).
Ignora subtotali, IVA separata, sconti parziali.

=== REGOLE CATENA / NEGOZIO ===
- "store": nome ESATTO come appare sullo scontrino
- "storeChain": usa uno di questi nomi normalizzati se il negozio corrisponde:
  Standard: Esselunga, Coop, Ipercoop, UniCoop, NovaCoop, Conad, Conad City, Conad Superstore, Carrefour, Carrefour Express, Carrefour Market, Carrefour Iper, Pam, Panorama, Pam Local, Despar, Eurospar, Interspar, Spar, Bennet, Il Gigante, Tigros, Sigma, Crai, E.Leclerc, Famila, Tuodì, Cadoro, Dì per Dì, Prix Quality, Coal, A&O, Selex, Iper, Billa, Simply Market
  Bio/Naturale: NaturaSì, Bioessepiù, Ecor, Life, BioBottega
  Discount: Lidl, Aldi, Eurospin, Penny, Penny Market, MD Discount, In's Mercato, Ard Discount, Todis, Dok Discount

=== REGOLE PROVINCIA ===
Deduci la provincia dal CAP o dall'indirizzo stampato sullo scontrino:
- 10100-10199 = Torino, 20100-20199 = Milano, 00100-00199 = Roma, 40100-40199 = Bologna
- 50100-50199 = Firenze, 80100-80199 = Napoli, 70100-70199 = Bari, 90100-90199 = Palermo
- 16100-16199 = Genova, 35100-35199 = Padova, 37100-37199 = Verona, 34100-34199 = Trieste
- 25100-25199 = Brescia, 24100-24199 = Bergamo, 21100-21199 = Varese, 20900-20999 = Monza
- 22100-22199 = Como, 27100-27199 = Pavia, 23100-23199 = Sondrio, 26100-26199 = Cremona
- 46100-46199 = Mantova, 43100-43199 = Parma, 41100-41199 = Modena, 44100-44199 = Ferrara
- 47100-47199 = Forlì, 48100-48199 = Ravenna, 47900 = Rimini, 61100-61199 = Pesaro
- 60100-60199 = Ancona, 62100-62199 = Macerata, 63100-63199 = Ascoli Piceno
- 06100-06199 = Perugia, 05100-05199 = Terni, 55100-55199 = Lucca, 56100-56199 = Pisa
- 57100-57199 = Livorno, 53100-53199 = Siena, 52100-52199 = Arezzo, 58100-58199 = Grosseto
- 01100-01199 = Viterbo, 02100-02199 = Rieti, 04100-04199 = Latina, 03100-03199 = Frosinone
- 81100-81199 = Caserta, 82100-82199 = Benevento, 83100-83199 = Avellino, 84100-84199 = Salerno
- 71100-71199 = Foggia, 72100-72199 = Brindisi, 74100-74199 = Taranto, 75100-75199 = Matera
- 85100-85199 = Potenza, 88100-88199 = Catanzaro, 89100-89199 = Reggio Calabria
- 91100-91199 = Trapani, 92100-92199 = Agrigento, 93100-93199 = Caltanissetta, 94100-94199 = Enna
- 95100-95199 = Catania, 96100-96199 = Siracusa, 97100-97199 = Ragusa, 98100-98199 = Messina
- 07100-07199 = Sassari, 09100-09199 = Cagliari, 08100-08199 = Nuoro, 09170 = Oristano
- 11100-11199 = Aosta, 38100-38199 = Trento, 39100-39199 = Bolzano, 33100-33199 = Udine
- 34170 = Gorizia, 32100-32199 = Belluno, 31100-31199 = Treviso, 36100-36199 = Vicenza
- 45100-45199 = Rovigo, 30100-30199 = Venezia, 15100-15199 = Alessandria, 14100-14199 = Asti
- 12100-12199 = Cuneo, 13100-13199 = Vercelli, 28100-28199 = Novara, 28900 = Verbano-Cusio-Ossola
- 13900 = Biella, 15060 = Ovada (AL), 17100-17199 = Savona, 18100-18199 = Imperia, 19100-19199 = La Spezia
In alternativa, usa la città capoluogo che appare nell'indirizzo per dedurre la provincia.
Se non riesci a determinare la provincia, usa null.

=== REGOLE PRODOTTI ===
- Includi SOLO prodotti il cui nome è chiaramente leggibile
- "raw": testo LETTERALE dallo scontrino, "name": forma normalizzata leggibile
- Normalizza SOLO abbreviazioni inequivocabili (es. "PAST PENNE 500G" → "Pasta Penne")
- Escludi: totali, IVA, sconti, date, codici, info negozio. Max 15 prodotti.

=== CAMPO "complete" ===
- true: hai letto con certezza sia la data che il totale
- false: almeno uno dei due manca o è illeggibile`,
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

    function normalizeItalianDate(raw: string | null | undefined): string | null {
      if (!raw || typeof raw !== "string") return null;
      const s = raw.trim();
      const now = new Date();
      const currentYear = now.getFullYear();

      const sep = "[\\s/\\.\\-]";
      const patterns: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
        [/^(\d{4})-(\d{2})-(\d{2})$/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
        [new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4})$`), (m) => `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`],
        [new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{2})$`), (m) => `20${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`],
        [new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})$`), (m) => `${currentYear}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`],
      ];

      for (const [re, build] of patterns) {
        const m = s.match(re);
        if (m) {
          const candidate = build(m);
          if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
            const d = new Date(candidate);
            if (!isNaN(d.getTime())) return candidate;
          }
        }
      }
      return null;
    }

    let extractedDate = normalizeItalianDate(parsed.date);
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

export interface PendingProduct {
  name: string;
  matched: boolean;
  barcode: string | null;
  ecoScore: string | null;
  points: number;
  emoji: string | null;
  category: string | null;
}

export async function matchProductToReceipt(
  barcodeProductName: string,
  receiptProducts: PendingProduct[],
): Promise<{ matched: boolean; productName: string | null }> {
  const unmatched = receiptProducts.filter((p) => !p.matched);
  if (unmatched.length === 0) return { matched: false, productName: null };

  try {
    const productList = unmatched.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Prodotto scansionato dal barcode: "${barcodeProductName}"

Lista prodotti dallo scontrino (non ancora verificati):
${productList}

Questo prodotto corrisponde a uno dei prodotti sullo scontrino? Considera varianti di nome, abbreviazioni italiane e formati diversi (es. "Pasta Barilla Fusilli 500g" corrisponde a "PAST FUSIL 500G").

Rispondi SOLO con JSON valido: {"matched": true/false, "productIndex": numero (1-N) o null}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { matched: false, productName: null };

    const parsed = JSON.parse(jsonMatch[0]) as { matched?: boolean; productIndex?: number | null };

    if (
      parsed.matched === true &&
      typeof parsed.productIndex === "number" &&
      parsed.productIndex >= 1 &&
      parsed.productIndex <= unmatched.length
    ) {
      return { matched: true, productName: unmatched[parsed.productIndex - 1].name };
    }
    return { matched: false, productName: null };
  } catch (err) {
    console.error("[matchProductToReceipt]", err);
    return { matched: false, productName: null };
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
