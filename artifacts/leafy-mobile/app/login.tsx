import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";

type Mode = "login" | "register";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setUser, refetch } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setEmail("");
    setPassword("");
    setUsername("");
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      return;
    }
    if (mode === "register" && !username.trim()) {
      setError("Inserisci un nome utente.");
      return;
    }
    if (password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, username };

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Si è verificato un errore.");
        return;
      }

      if (data.user) {
        setUser(data.user);
      }
      router.replace("/(tabs)");
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    setOauthLoading(provider);
    try {
      const url = `${BASE_URL}/api/auth/${provider}`;
      if (Platform.OS === "web") {
        window.location.href = url;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, "leafy-mobile://");
      if (result.type === "success") {
        await refetch();
        router.replace("/(tabs)");
      }
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <MaterialCommunityIcons name="leaf" size={32} color={Colors.leaf} />
          </View>
          <Text style={styles.appName}>Leafy</Text>
          <Text style={styles.tagline}>Acquisti sostenibili, punti reali</Text>

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(["login", "register"] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.tab, mode === m && styles.tabActive]}
                  onPress={() => switchMode(m)}
                >
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {m === "login" ? "Accedi" : "Registrati"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === "register" && (
              <View style={styles.inputWrap}>
                <Feather name="user" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome utente"
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password (min. 8 caratteri)"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType={mode === "login" ? "password" : "newPassword"}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={Colors.textMuted}
                />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.leaf, "#23533e"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mode === "login" ? "Accedi" : "Crea account"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oppure</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleOAuth("google")}
              disabled={!!oauthLoading}
            >
              {oauthLoading === "google" ? (
                <ActivityIndicator color={Colors.forest} size="small" />
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleG}>G</Text>
                  </View>
                  <Text style={styles.oauthBtnText}>Continua con Google</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleOAuth("facebook")}
              disabled={!!oauthLoading}
            >
              {oauthLoading === "facebook" ? (
                <ActivityIndicator color={Colors.forest} size="small" />
              ) : (
                <>
                  <View style={[styles.fbIcon]}>
                    <Text style={styles.fbF}>f</Text>
                  </View>
                  <Text style={styles.oauthBtnText}>Continua con Facebook</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.terms}>
              Continuando accetti i Termini di Servizio e la Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  appName: {
    fontSize: 36,
    fontFamily: Fonts.displayBold,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    fontFamily: Fonts.bodyRegular,
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: "center",
  },
  card: {
    width: "100%",
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.cardAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.forest,
    fontFamily: Fonts.bodySemiBold,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    gap: 8,
  },
  inputIcon: {
    width: 18,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.bodyRegular,
    color: Colors.text,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.bodyRegular,
    color: "#DC2626",
    flex: 1,
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  primaryBtnGradient: {
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: Fonts.displayBold,
    color: "#fff",
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: Fonts.bodyRegular,
    color: Colors.textMuted,
  },
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: Colors.card,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: "#4285F4",
    lineHeight: 16,
  },
  fbIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
  },
  fbF: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: "#fff",
    lineHeight: 18,
  },
  oauthBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.text,
  },
  terms: {
    fontSize: 11,
    fontFamily: Fonts.bodyRegular,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
});
