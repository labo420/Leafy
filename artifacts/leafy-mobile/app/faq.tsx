import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/theme";

const FAQ_ITEMS = [
  {
    q: "Come funziona Leafy?",
    a: "Scansiona il tuo scontrino dopo aver fatto la spesa. Leafy identifica i prodotti sostenibili e ti assegna XP e $LEA in base al loro Eco-Score.",
  },
  {
    q: "Cos'è l'Eco-Score?",
    a: "L'Eco-Score è un punteggio che valuta l'impatto ambientale di un prodotto, dalla produzione al packaging. Più alto è il punteggio, più XP guadagni.",
  },
  {
    q: "Cos'è il $LEA?",
    a: "$LEA è la valuta cashback di Leafy. 1 XP = 0,01€ in $LEA. Accumula $LEA e ritirali su PayPal (richiede Leafy Gold attivo).",
  },
  {
    q: "Cos'è Leafy Gold?",
    a: "Leafy Gold è l'abbonamento mensile di Leafy a 0,89€/mese. Con Leafy Gold attivo i tuoi $LEA guadagnati su ogni scontrino vengono raddoppiati (x2), e puoi prelevare i tuoi $LEA su PayPal.",
  },
  {
    q: "Quali negozi sono accettati?",
    a: "Leafy accetta scontrini dei principali supermercati italiani (Esselunga, Coop, Lidl, Aldi, Carrefour, ecc.), negozi bio e discount. Vedi la lista completa nella schermata Scansiona.",
  },
  {
    q: "Quanto tempo ho per scansionare i barcode?",
    a: "Dopo aver scansionato uno scontrino, hai 24 ore per inquadrare i codici a barre dei prodotti idonei e guadagnare i tuoi punti.",
  },
  {
    q: "Come funziona il sistema livelli?",
    a: "Ci sono 5 livelli: 🌱 Germoglio (0 XP), 🌿 Ramoscello (500 XP), 🍃 Arbusto (1.500 XP), 🌳 Albero (5.000 XP), 🌲 Foresta (10.000 XP). Ogni livello sblocca badge ed obiettivi speciali.",
  },
  {
    q: "Come contatto il supporto?",
    a: "Per assistenza scrivi a supporto@leafy.app. Il team risponde entro 24 ore nei giorni lavorativi.",
  },
];

function FaqItem({ item, index, theme }: { item: typeof FAQ_ITEMS[0]; index: number; theme: import("@/constants/theme").ThemeColors }) {
  const [open, setOpen] = useState(false);
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <Pressable
        style={[styles.item, { backgroundColor: theme.card, borderColor: open ? "rgba(46,107,80,0.2)" : theme.border }]}
        onPress={() => setOpen(!open)}
      >
        <View style={styles.itemHeader}>
          <Text style={[styles.question, { color: theme.text }]}>{item.q}</Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
        </View>
        {open && (
          <Text style={[styles.answer, { color: theme.textSecondary }]}>{item.a}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const { theme } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: theme.leaf }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Aiuto e FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.introCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="help-circle" size={28} color={theme.leaf} />
          <Text style={[styles.introTitle, { color: theme.text }]}>Come possiamo aiutarti?</Text>
          <Text style={[styles.introSub, { color: theme.textSecondary }]}>
            Trova le risposte alle domande più frequenti su Leafy.
          </Text>
        </View>

        <View style={styles.list}>
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} item={item} index={i} theme={theme} />
          ))}
        </View>

        <View style={[styles.contactCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="mail" size={20} color={theme.leaf} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTitle, { color: theme.text }]}>Hai altre domande?</Text>
            <Text style={[styles.contactSub, { color: theme.leaf }]}>supporto@leafy.app</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    color: "#fff",
  },
  content: {
    padding: 20,
  },
  introCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    textAlign: "center",
  },
  introSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    gap: 8,
    marginBottom: 24,
  },
  item: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  question: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    lineHeight: 22,
  },
  answer: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginTop: 12,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
  },
  contactTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  contactSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
