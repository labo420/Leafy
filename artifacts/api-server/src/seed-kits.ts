import { db, sustainabilityKitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const KITS = [
  {
    name: "Kit Colazione Bio",
    description: "Inizia la giornata con tre prodotti green per una colazione sostenibile.",
    rewardXp: 60,
    slots: [
      { id: "veg_milk", label: "Latte vegetale", matchCategories: ["Vegano"] },
      { id: "organic_cereal", label: "Cereale o muesli bio", matchCategories: ["Bio"] },
      { id: "bio_jam", label: "Confettura o marmellata bio", matchCategories: ["Bio", "Km 0"] },
    ],
  },
  {
    name: "Kit Pulizia Eco",
    description: "Rivoluziona la pulizia di casa con prodotti rispettosi dell'ambiente.",
    rewardXp: 50,
    slots: [
      { id: "eco_detergent", label: "Detersivo eco", matchCategories: ["Senza Plastica", "Bio"] },
      { id: "eco_fabric", label: "Ammorbidente o detergente bucato eco", matchCategories: ["Senza Plastica"] },
      { id: "bio_cleaner", label: "Prodotto pulizie bio/naturale", matchCategories: ["Bio", "Artigianale"] },
    ],
  },
  {
    name: "Kit Verdura di Stagione",
    description: "Tre prodotti bio o a km 0 dal reparto ortofrutta per ridurre l'impatto ambientale.",
    rewardXp: 45,
    slots: [
      { id: "veg_1", label: "Primo prodotto bio o km 0", matchCategories: ["Bio", "Km 0"] },
      { id: "veg_2", label: "Secondo prodotto bio o km 0", matchCategories: ["Bio", "Km 0"] },
      { id: "veg_3", label: "Terzo prodotto bio o km 0", matchCategories: ["Bio", "Km 0"] },
    ],
  },
];

export async function seedKits(): Promise<void> {
  for (const kit of KITS) {
    const [existing] = await db.select({ id: sustainabilityKitsTable.id })
      .from(sustainabilityKitsTable)
      .where(eq(sustainabilityKitsTable.name, kit.name));

    if (existing) continue;

    await db.insert(sustainabilityKitsTable).values({
      name: kit.name,
      description: kit.description,
      rewardXp: kit.rewardXp,
      slotsJson: JSON.stringify(kit.slots),
      isActive: true,
    });

    console.log(`[seed-kits] Seeded kit: ${kit.name}`);
  }
}
