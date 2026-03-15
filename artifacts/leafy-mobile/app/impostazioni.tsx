import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.rowIconCircle}>
        <Feather name={icon} size={16} color={Colors.leaf} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={Colors.textMuted} /> : null}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconCircle}>
        <Feather name={icon} size={16} color={Colors.leaf} />
      </View>
      <View style={styles.toggleTextCol}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.mint }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function ImpostazioniScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [challengeAlerts, setChallengeAlerts] = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Sei sicuro?",
      "Questa azione è irreversibile. Tutti i tuoi dati, punti e badge verranno cancellati permanentemente.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Cancella account",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch("/profile/account", { method: "DELETE" });
              queryClient.clear();
              logout();
              router.replace("/(tabs)");
            } catch {
              Alert.alert("Errore", "Non è stato possibile cancellare l'account.");
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: topPadding + 16 }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.title}>Impostazioni</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <SettingsRow icon="user" label="Nome utente" value={user?.firstName ?? ""} />
            <View style={styles.divider} />
            <SettingsRow icon="mail" label="Email" value={user?.email ?? ""} />
          </View>

          <Text style={styles.sectionLabel}>Notifiche</Text>
          <View style={styles.card}>
            <ToggleRow
              icon="bell"
              label="Notifiche push"
              description="Avvisi su punti e sfide"
              value={pushNotifications}
              onChange={setPushNotifications}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon="mail"
              label="Notifiche email"
              description="Aggiornamenti settimanali via email"
              value={emailNotifications}
              onChange={setEmailNotifications}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon="globe"
              label="Report settimanale"
              description="Riepilogo del tuo impatto verde"
              value={weeklyReport}
              onChange={setWeeklyReport}
            />
            <View style={styles.divider} />
            <ToggleRow
              icon="bell"
              label="Avvisi sfide"
              description="Promemoria scadenze sfide mensili"
              value={challengeAlerts}
              onChange={setChallengeAlerts}
            />
          </View>

          <Text style={styles.sectionLabel}>Privacy e Sicurezza</Text>
          <View style={styles.card}>
            <SettingsRow icon="shield" label="Informativa Privacy" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingsRow icon="lock" label="Termini di Servizio" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingsRow icon="globe" label="Lingua" value="Italiano" onPress={() => {}} />
          </View>

          <Text style={styles.sectionLabel}>Zona Pericolo</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={handleDeleteAccount}>
              <View style={[styles.rowIconCircle, { backgroundColor: "rgba(239,67,67,0.1)" }]}>
                <Feather name="trash-2" size={16} color={Colors.red} />
              </View>
              <Text style={[styles.rowLabel, { color: Colors.red }]}>Cancella account</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(46,107,80,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginRight: 4,
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 60,
  },
});
