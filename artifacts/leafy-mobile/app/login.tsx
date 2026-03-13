import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { refetch } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const loginUrl = `${base}/api/auth/browser?redirectTo=/`;
      if (Platform.OS === "web") {
        window.location.href = loginUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(loginUrl, "leafy-mobile://");
        if (result.type === "success") {
          await refetch();
          router.replace("/(tabs)");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[Colors.forest, Colors.leaf, Colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
    >
      <View style={styles.logo}>
        <MaterialCommunityIcons name="leaf" size={64} color={Colors.primaryLight} />
      </View>

      <Text style={styles.title}>Leafy</Text>
      <Text style={styles.subtitle}>
        Acquisti sostenibili,{"\n"}punti reali
      </Text>

      <View style={styles.features}>
        {[
          { icon: "camera", text: "Scansiona i tuoi scontrini" },
          { icon: "award", text: "Guadagna punti green" },
          { icon: "gift", text: "Riscatta premi esclusivi" },
        ].map((f) => (
          <View key={f.icon} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Feather name={f.icon as any} size={18} color={Colors.primary} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.forest} />
        ) : (
          <Text style={styles.buttonText}>Accedi con Replit</Text>
        )}
      </Pressable>

      <Text style={styles.terms}>
        Continuando accetti i Termini di Servizio e la Privacy Policy
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 48,
  },
  features: {
    width: "100%",
    marginBottom: 48,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  button: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.forest,
  },
  terms: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 18,
  },
});
