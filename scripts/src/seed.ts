import { db, vouchersTable, challengesTable, greenProductsTable } from "@workspace/db";

async function seed() {
  console.log("🌿 Seeding Leafy database...");

  // Seed green products
  const products = [
    { name: "Latte Biologico", brand: "Bio Natura", category: "Bio", certifications: ["Bio EU", "Senza OGM"], sustainabilityScore: 9, pointsValue: 15, emoji: "🥛", description: "Latte fresco da allevamenti biologici certificati.", keywords: ["latte biologico", "bio"] },
    { name: "Mele Golden Bio", brand: "Frutteto Verde", category: "Bio", certifications: ["Bio EU", "Km 0"], sustainabilityScore: 10, pointsValue: 18, emoji: "🍎", description: "Mele biologiche raccolte localmente.", keywords: ["mele bio", "biologico", "km 0"] },
    { name: "Pasta di Semola Bio", brand: "Mulino Sano", category: "Bio", certifications: ["Bio EU"], sustainabilityScore: 8, pointsValue: 12, emoji: "🍝", description: "Pasta artigianale da grano biologico.", keywords: ["pasta bio", "semola biologica"] },
    { name: "Verdure di Stagione Km 0", brand: "Orto Locale", category: "Km 0", certifications: ["Filiera Corta"], sustainabilityScore: 9, pointsValue: 12, emoji: "🥦", description: "Verdure fresche dal contadino a km 0.", keywords: ["verdure km 0", "locale", "filiera corta"] },
    { name: "Pane Artigianale", brand: "Forno del Borgo", category: "Artigianale", certifications: ["Artigianale"], sustainabilityScore: 7, pointsValue: 8, emoji: "🍞", description: "Pane fatto a mano con lievito madre.", keywords: ["pane artigianale", "fatto a mano"] },
    { name: "Sapone Solido Eco", brand: "EcoClean", category: "Senza Plastica", certifications: ["Plastic Free", "Biodegradabile"], sustainabilityScore: 10, pointsValue: 20, emoji: "🧼", description: "Sapone in formato solido, zero imballaggi plastici.", keywords: ["sapone senza plastica", "plastic free"] },
    { name: "Caffè Fairtrade", brand: "Solidarietà Caffè", category: "Equo Solidale", certifications: ["Fairtrade", "Rainforest Alliance"], sustainabilityScore: 9, pointsValue: 18, emoji: "☕", description: "Caffè equo solidale da cooperative del Sud America.", keywords: ["fairtrade", "equo solidale", "caffè"] },
    { name: "Burger Vegetale", brand: "VeggieLife", category: "Vegano", certifications: ["Vegan Society", "Bio EU"], sustainabilityScore: 9, pointsValue: 15, emoji: "🌱", description: "Burger plant-based ricco di proteine vegetali.", keywords: ["vegano", "plant based", "burger vegetale"] },
    { name: "Lenticchie Bio DOP", brand: "Umbria Verde", category: "DOP/IGP", certifications: ["DOP", "Bio EU"], sustainabilityScore: 9, pointsValue: 14, emoji: "🏷️", description: "Lenticchie di Castelluccio IGP, coltivazione biologica.", keywords: ["dop", "igp", "lenticchie"] },
    { name: "Yogurt Vegetale", brand: "Natura Viva", category: "Vegano", certifications: ["Vegan OK"], sustainabilityScore: 8, pointsValue: 12, emoji: "🥛", description: "Yogurt 100% vegetale a base di cocco.", keywords: ["yogurt vegano", "vegetale", "vegan"] },
    { name: "Olio EVO Bio Km 0", brand: "Olive del Sud", category: "Bio", certifications: ["Bio EU", "Km 0"], sustainabilityScore: 10, pointsValue: 20, emoji: "🫒", description: "Olio extravergine di oliva biologico a km 0.", keywords: ["olio bio", "extravergine biologico", "km 0"] },
    { name: "Shampoo Solido", brand: "GreenHair", category: "Senza Plastica", certifications: ["Plastic Free", "Vegan OK"], sustainabilityScore: 9, pointsValue: 18, emoji: "🧴", description: "Shampoo in barra solida, nessun flacone plastico.", keywords: ["shampoo senza plastica", "solido", "zero plastica"] },
    { name: "Cioccolato Equo", brand: "ChocoFair", category: "Equo Solidale", certifications: ["Fairtrade", "Rainforest Alliance"], sustainabilityScore: 9, pointsValue: 16, emoji: "🍫", description: "Cioccolato fondente da cacao equo solidale.", keywords: ["cioccolato fairtrade", "equo", "commercio equo"] },
    { name: "Pomodori Ciliegino Km 0", brand: "Orto Felice", category: "Km 0", certifications: ["Filiera Corta", "Bio EU"], sustainabilityScore: 10, pointsValue: 15, emoji: "🍅", description: "Pomodorini freschi raccolti ogni mattina.", keywords: ["pomodori km 0", "ciliegino", "locale"] },
    { name: "Farina di Kamut Bio", brand: "Grani Antichi", category: "Bio", certifications: ["Bio EU"], sustainabilityScore: 8, pointsValue: 12, emoji: "🌾", description: "Farina di grano khorasan biologico antico.", keywords: ["farina bio", "kamut", "biologico"] },
    { name: "Detergente Piatti Eco", brand: "CleanEco", category: "Senza Plastica", certifications: ["Ecocert", "Biodegradabile"], sustainabilityScore: 8, pointsValue: 15, emoji: "🍃", description: "Detergente piatti in polvere, imballaggio riciclato.", keywords: ["detergente ecologico", "senza plastica", "ecocert"] },
    { name: "Quinoa Bio", brand: "Andean Bio", category: "Bio", certifications: ["Bio EU", "Fairtrade"], sustainabilityScore: 9, pointsValue: 15, emoji: "🌿", description: "Quinoa biologica da coltivatori boliviani equi.", keywords: ["quinoa bio", "biologico"] },
    { name: "Pecorino DOP", brand: "Pastori del Monte", category: "DOP/IGP", certifications: ["DOP"], sustainabilityScore: 8, pointsValue: 12, emoji: "🧀", description: "Pecorino toscano DOP da latte di pecora locale.", keywords: ["pecorino dop", "formaggio dop"] },
    { name: "Vino Bio Km 0", brand: "Cantina Verde", category: "Bio", certifications: ["Bio EU", "Km 0"], sustainabilityScore: 9, pointsValue: 16, emoji: "🍷", description: "Vino biologico da vigneto locale a conduzione familiare.", keywords: ["vino bio", "biologico", "km 0"] },
    { name: "Miele Artigianale", brand: "Api Felici", category: "Artigianale", certifications: ["Artigianale", "Filiera Corta"], sustainabilityScore: 9, pointsValue: 10, emoji: "🍯", description: "Miele grezzo di produzione propria.", keywords: ["miele artigianale", "produzione propria"] },
    { name: "Borsa in Cotone Biologico", brand: "EcoStyle", category: "Senza Plastica", certifications: ["GOTS", "Bio EU"], sustainabilityScore: 10, pointsValue: 20, emoji: "🛍️", description: "Shopper in cotone organico, alternativa alle borse plastiche.", keywords: ["borsa senza plastica", "cotone bio", "plasticfree"] },
    { name: "Latte di Avena", brand: "OatGreen", category: "Vegano", certifications: ["Vegan OK", "Carbon Neutral"], sustainabilityScore: 10, pointsValue: 14, emoji: "🌾", description: "Bevanda vegetale di avena a basso impatto idrico.", keywords: ["latte avena", "vegano", "plant based"] },
  ];

  const existingProducts = await db.select().from(greenProductsTable);
  if (existingProducts.length === 0) {
    await db.insert(greenProductsTable).values(products as any);
    console.log(`✅ Inserted ${products.length} green products`);
  } else {
    console.log(`⏭️ Products already seeded (${existingProducts.length} found)`);
  }

  // Seed vouchers
  const now = new Date();
  const in60days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const vouchers = [
    { title: "10% su tutto il carrello", description: "Sconto del 10% su tutti i prodotti biologici del negozio.", brandName: "Bio Market", category: "Alimentari", pointsCost: 200, discount: "10%", expiresAt: in60days, stock: 50, isActive: true },
    { title: "Borsa shopper in cotone", description: "Shopper riutilizzabile in cotone biologico certificato GOTS.", brandName: "EcoStyle", category: "Lifestyle", pointsCost: 350, discount: "Omaggio", expiresAt: in30days, stock: 30, isActive: true },
    { title: "5€ di sconto", description: "5€ di sconto sul tuo prossimo acquisto di prodotti km 0.", brandName: "Orto Locale", category: "Alimentari", pointsCost: 150, discount: "5€", expiresAt: in60days, stock: null, isActive: true },
    { title: "Caffè Fairtrade in omaggio", description: "Un pacchetto da 250g di caffè equo solidale.", brandName: "Solidarietà Caffè", category: "Bevande", pointsCost: 300, discount: "Omaggio", expiresAt: in90days, stock: 20, isActive: true },
    { title: "20% sugli integratori Bio", description: "Sconto del 20% sulla linea di integratori biologici.", brandName: "Natura Pura", category: "Salute", pointsCost: 400, discount: "20%", expiresAt: in60days, stock: 40, isActive: true },
    { title: "Spedizione gratuita", description: "Spedizione gratuita su qualsiasi ordine online.", brandName: "EcoShop Online", category: "E-commerce", pointsCost: 100, discount: "Gratis", expiresAt: in30days, stock: null, isActive: true },
    { title: "Kit detergenti eco", description: "Set di 3 detergenti ecologici senza plastica.", brandName: "CleanEco", category: "Casa", pointsCost: 500, discount: "Omaggio", expiresAt: in90days, stock: 15, isActive: true },
    { title: "15% da Sapori Vegani", description: "15% di sconto su tutto il menu vegano.", brandName: "Sapori Vegani", category: "Ristorazione", pointsCost: 250, discount: "15%", expiresAt: in60days, stock: null, isActive: true },
    { title: "Borse riutilizzabili set 3", description: "Set da 3 borse in rete per la spesa sfusa.", brandName: "ZeroWaste Shop", category: "Lifestyle", pointsCost: 200, discount: "Omaggio", expiresAt: in90days, stock: 25, isActive: true },
    { title: "Corso cucina sostenibile", description: "Partecipa gratuitamente a un corso di cucina plant-based.", brandName: "GreenChef Academy", category: "Esperienze", pointsCost: 800, discount: "Gratis", expiresAt: in90days, stock: 10, isActive: true },
  ];

  const existingVouchers = await db.select().from(vouchersTable);
  if (existingVouchers.length === 0) {
    await db.insert(vouchersTable).values(vouchers as any);
    console.log(`✅ Inserted ${vouchers.length} vouchers`);
  } else {
    console.log(`⏭️ Vouchers already seeded (${existingVouchers.length} found)`);
  }

  // Seed challenges
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const challenges = [
    { title: "Bio di Marzo", description: "Acquista 5 prodotti biologici questo mese.", category: "Bio", emoji: "🌱", targetCount: 5, rewardPoints: 100, expiresAt: endOfMonth, isActive: true },
    { title: "Zero Plastica", description: "Trova 3 prodotti senza plastica nei tuoi scontrini.", category: "Senza Plastica", emoji: "♻️", targetCount: 3, rewardPoints: 150, expiresAt: endOfMonth, isActive: true },
    { title: "Km Zero Hero", description: "Compra 4 prodotti a km 0 durante il mese.", category: "Km 0", emoji: "📍", targetCount: 4, rewardPoints: 120, expiresAt: endOfMonth, isActive: true },
    { title: "Scansionatore Seriale", description: "Scansiona 3 scontrini in questo mese.", category: "tutti", emoji: "📷", targetCount: 3, rewardPoints: 80, expiresAt: endOfMonth, isActive: true },
    { title: "Equo Solidale", description: "Acquista 2 prodotti con certificazione Fairtrade.", category: "Equo Solidale", emoji: "❤️", targetCount: 2, rewardPoints: 90, expiresAt: endOfMonth, isActive: true },
  ];

  const existingChallenges = await db.select().from(challengesTable);
  if (existingChallenges.length === 0) {
    await db.insert(challengesTable).values(challenges as any);
    console.log(`✅ Inserted ${challenges.length} challenges`);
  } else {
    console.log(`⏭️ Challenges already seeded (${existingChallenges.length} found)`);
  }

  console.log("🌿 Leafy database seeded successfully!");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
