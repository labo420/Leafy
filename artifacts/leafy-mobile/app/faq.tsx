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
import Colors from "@/constants/colors";

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
    a: "$LEA è la valuta cashback di Leafy. 1 XP = 0,01€ in $LEA. Accumula $LEA e ritirali su PayPal (richiede Battle Pass attivo).",
  },
  {
    q: "Cos'è il Battle Pass?",
    a: "Il Battle Pass è l'abbonamento mensile di Leafy a 0,89€/mese. Con il Battle Pass attivo i tuoi $LEA guadagnati su ogni scontrino vengono raddoppiati (x2), e puoi prelevare i tuoi $LEA su PayPal.",
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

function FaqItem({ item, index }: { item: typeof FAQ_ITEMS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <Pressable style={[styles.item, open && styles.itemOpen]} onPress={() => setOpen(!open)}>
        <View style={styles.itemHeader}>
          <Text style={styles.question}>{item.q}</Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={Colors.textSecondary} />
        </View>
        {open && (
          <Text style={styles.answer}>{item.a}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Aiuto e FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.introCard}>
          <Feather name="help-circle" size={28} color={Colors.leaf} />
          <Text style={styles.introTitle}>Come possiamo aiutarti?</Text>
          <Text style={styles.introSub}>
            Trova le risposte alle domande più frequenti su Leafy.
          </Text>
        </View>

        <View style={styles.list}>
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} item={item} index={i} />
          ))}
        </View>

        <View style={styles.contactCard}>
          <Feather name="mail" size={20} color={Colors.leaf} />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Hai altre domande?</Text>
            <Text style={styles.contactSub}>supporto@leafy.app</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.leaf,
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
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  introSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    gap: 8,
    marginBottom: 24,
  },
  item: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemOpen: {
    borderColor: "rgba(46,107,80,0.2)",
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
    color: Colors.text,
    flex: 1,
    lineHeight: 22,
  },
  answer: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: 12,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
  },
  contactTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  contactSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.leaf,
    marginTop: 2,
  },
});
