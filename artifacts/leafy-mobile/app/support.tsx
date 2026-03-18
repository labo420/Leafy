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
import { useTheme } from "@/context/theme";

export default function SupportScreen() {
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
        <Text style={styles.headerTitle}>Aiuto e Supporto</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(60).springify()} style={[styles.heroCard, { backgroundColor: theme.primaryLight }]}>
          <View style={[styles.heroIconWrap, { backgroundColor: theme.card }]}>
            <Feather name="life-buoy" size={32} color={theme.leaf} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Siamo qui per aiutarti</Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
            Il nostro team risponde entro 24 ore nei giorni lavorativi.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify()} style={[styles.contactCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.contactIconWrap, { backgroundColor: theme.primaryLight }]}>
            <Feather name="mail" size={22} color={theme.leaf} />
          </View>
          <View style={styles.contactBody}>
            <Text style={[styles.contactTitle, { color: theme.text }]}>Hai problemi con la scansione di uno scontrino?</Text>
            <Text style={[styles.contactSub, { color: theme.textSecondary }]}>Scrivici a</Text>
            <Pressable
              onPress={() => Linking.openURL("mailto:support@leafy.app")}
              style={[styles.emailBtn, { backgroundColor: theme.leaf }]}
            >
              <Feather name="send" size={14} color="#fff" />
              <Text style={styles.emailBtnText}>support@leafy.app</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Pressable style={[styles.faqRow, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push("/faq")}>
            <View style={[styles.faqRowIcon, { backgroundColor: theme.primaryLight }]}>
              <Feather name="help-circle" size={20} color={theme.leaf} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.faqRowTitle, { color: theme.text }]}>Vai alle FAQ</Text>
              <Text style={[styles.faqRowSub, { color: theme.textSecondary }]}>Domande frequenti su Leafy</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
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
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  contactCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    lineHeight: 22,
  },
  contactSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  faqRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  faqRowTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  faqRowSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
