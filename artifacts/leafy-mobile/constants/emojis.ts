export function getProductEmoji(
  name: string,
  category?: string | null,
  aiEmoji?: string | null,
): string {
  if (aiEmoji && aiEmoji.trim().length > 0) return aiEmoji;

  const n = name.toLowerCase();

  if (n.includes("hamburger") || n.includes("burger") || n.includes("burgee") || n.includes("burgher")) return "🍔";
  if (n.includes("fragol")) return "🍓";
  if (n.includes("pasta") || n.includes("penne") || n.includes("spaghetti") || n.includes("fusilli") || n.includes("rigatoni")) return "🍝";
  if (n.includes("riso") || n.includes("risotto")) return "🍚";
  if (n.includes("latte") || n.includes("yogurt") || n.includes("yoghurt")) return "🥛";
  if (n.includes("mozzarella") || n.includes("formaggio") || n.includes("parmigian") || n.includes("grana") || n.includes("ricotta") || n.includes("stracchino") || n.includes("besciamella")) return "🧀";
  if (n.includes("pane") || n.includes("biscott") || n.includes("focaccia") || n.includes("crackers") || n.includes("grissini") || n.includes("fette biscot")) return "🍞";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("birra")) return "🍺";
  if (n.includes("vino")) return "🍷";
  if (n.includes("cafe") || n.includes("caffè") || n.includes("caffe")) return "☕";
  if (n.includes("mela") || n.includes("banana") || n.includes("arancia") || n.includes("frutta")) return "🍎";
  if (n.includes("pollo") || n.includes("tacchino")) return "🍗";
  if (n.includes("salsiccia") || n.includes("wurstel")) return "🌭";
  if (n.includes("carne") || n.includes("manzo") || n.includes("maiale") || n.includes("suino") || n.includes("vitello")) return "🥩";
  if (n.includes("pesce") || n.includes("salmone") || n.includes("tonno")) return "🐟";
  if (n.includes("olio") || n.includes("oliva")) return "🫒";
  if (n.includes("pomodoro") || n.includes("verdura") || n.includes("insalata") || n.includes("cetriolin")) return "🥗";
  if (n.includes("uova") || n.includes("uovo")) return "🥚";
  if (n.includes("shopper") || n.includes("busta") || n.includes("sacchetto")) return "🛍️";
  if (n.includes("detersivo") || n.includes("detergente")) return "🧼";
  if (n.includes("carta") || n.includes("igienica") || n.includes("tovag")) return "🧻";
  if (n.includes("dolce") || n.includes("cioccolat") || n.includes("snack")) return "🍫";
  if (n.includes("acqua") || n.includes("minerale")) return "💧";
  if (n.includes("succo") || n.includes("juice")) return "🧃";
  if (n.includes("bio") || n.includes("biologico") || n.includes("biologica") || n.includes("biotable")) return "🌿";
  if (n.includes("gelato")) return "🍦";
  if (n.includes("zucchero") || n.includes("miele")) return "🍯";
  if (n.includes("farina")) return "🌾";
  if (n.includes("sapone") || n.includes("shampoo")) return "🧴";
  if (n.includes("surgelat")) return "🧊";

  const cat = (category ?? "").toLowerCase();
  if (cat.includes("bio") || cat.includes("organic")) return "🌿";
  if (cat.includes("vegano") || cat.includes("vegan")) return "🥦";
  if (cat.includes("km 0") || cat.includes("locale") || cat.includes("local")) return "📍";
  if (cat.includes("equo") || cat.includes("fair")) return "🤝";
  if (cat.includes("dop") || cat.includes("igp") || cat.includes("artigian")) return "🏷️";
  if (cat.includes("plastica") || cat.includes("ricicl") || cat.includes("recycle")) return "♻️";
  if (cat.includes("carne") || cat.includes("pesce") || cat.includes("fish") || cat.includes("meat")) return "🍖";

  return "🛒";
}
