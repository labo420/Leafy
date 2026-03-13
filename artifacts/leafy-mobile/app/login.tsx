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
import { useAuth } from "@/context/auth";
import { apiBase } from "@/lib/api";

type Mode = "login" | "register";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register: doRegister, handleOAuthToken } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await doRegister(email.trim(), password, username.trim());
      }
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    try {
      const url = `${apiBase()}/auth/${provider}?mobile=1`;
      const result = await WebBrowser.openAuthSessionAsync(url, "leafy-mobile://auth");
      if (result.type === "success" && result.url) {
        const parsed = new URL(result.url);
        const sid = parsed.searchParams.get("sid");
        const authError = parsed.searchParams.get("error");
        if (sid) {
          await handleOAuthToken(sid);
          router.replace("/(tabs)");
        } else if (authError) {
          setError(`Errore con ${provider === "google" ? "Google" : "Facebook"}. Riprova.`);
        }
      }
    } catch {
      setError("Errore di connessione. Riprova.");
    }
  };

  return (
    <LinearGradient
      colors={[Colors.forest, Colors.leaf, Colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logo}>
            <MaterialCommunityIcons name="leaf" size={48} color={Colors.primaryLight} />
          </View>

          <Text style={styles.title}>Leafy</Text>
          <Text style={styles.subtitle}>
            {mode === "login"
              ? "Bentornato! Accedi al tuo account."
              : "Crea il tuo account gratuito."}
          </Text>

          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, mode === "login" && styles.tabActive]}
              onPress={() => { setMode("login"); setError(null); }}
            >
              <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
                Accedi
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === "register" && styles.tabActive]}
              onPress={() => { setMode("register"); setError(null); }}
            >
              <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
                Registrati
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            {mode === "register" && (
              <View style={styles.inputWrap}>
                <Feather name="user" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome utente"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Feather name="mail" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="Password (min. 8 caratteri)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.forest} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "login" ? "Accedi" : "Crea account"}
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleOAuth("google")}
            >
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialText}>Continua con Google</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.socialBtn, styles.facebookBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleOAuth("facebook")}
            >
              <Feather name="facebook" size={20} color="#fff" />
              <Text style={[styles.socialText, { color: "#fff" }]}>Continua con Facebook</Text>
            </Pressable>
          </View>

          <Text style={styles.terms}>
            Accedendo accetti i nostri Termini di Servizio e la Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 28,
  },
  tabRow: {
    flexDirection: "row",
    width: "100%",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
  },
  tabTextActive: {
    color: Colors.forest,
  },
  form: {
    width: "100%",
    gap: 12,
    marginBottom: 20,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#fff",
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#fca5a5",
  },
  submitBtn: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.forest,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  socialButtons: {
    width: "100%",
    gap: 10,
    marginBottom: 24,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
  },
  socialIcon: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#EA4335",
  },
  socialText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.forest,
  },
  facebookBtn: {
    backgroundColor: "#1877F2",
  },
  terms: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 16,
  },
});
