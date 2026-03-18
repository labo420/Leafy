import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Linking,
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

export default function SupportScreen() {
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
        <Text style={styles.headerTitle}>Aiuto e Supporto</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Feather name="life-buoy" size={32} color={Colors.leaf} />
          </View>
          <Text style={styles.heroTitle}>Siamo qui per aiutarti</Text>
          <Text style={styles.heroSub}>
            Il nostro team risponde entro 24 ore nei giorni lavorativi.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <Feather name="mail" size={22} color={Colors.leaf} />
          </View>
          <View style={styles.contactBody}>
            <Text style={styles.contactTitle}>Hai problemi con la scansione di uno scontrino?</Text>
            <Text style={styles.contactSub}>Scrivici a</Text>
            <Pressable
              onPress={() => Linking.openURL("mailto:support@leafy.app")}
              style={styles.emailBtn}
            >
              <Feather name="send" size={14} color="#fff" />
              <Text style={styles.emailBtnText}>support@leafy.app</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Pressable style={styles.faqRow} onPress={() => router.push("/faq")}>
            <View style={styles.faqRowIcon}>
              <Feather name="help-circle" size={20} color={Colors.leaf} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.faqRowTitle}>Domande frequenti</Text>
              <Text style={styles.faqRowSub}>Trova le risposte alle domande più comuni</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
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
    gap: 16,
  },
  heroCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contactBody: {
    flex: 1,
    gap: 6,
  },
  contactTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    lineHeight: 22,
  },
  contactSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.leaf,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  emailBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  faqRow: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  faqRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  faqRowTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  faqRowSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
