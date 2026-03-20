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
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";

type Mode = "login" | "register";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function HeroIllustration() {
  const floatY = useSharedValue(0);

  React.useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2200 }),
        withTiming(0, { duration: 2200 }),
      ),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(100).springify()} style={floatStyle}>
      <View style={styles.heroWrap}>
        <View style={styles.heroCircle}>
          <MaterialCommunityIcons name="watering-can" size={44} color="#fff" />
        </View>

        <View style={styles.heroReceipt}>
          <View style={[styles.heroLine, { width: "80%" }]} />
          <View style={[styles.heroLine, { width: "55%" }]} />
          <View style={[styles.heroLine, { width: "70%" }]} />
          <View style={styles.heroReceiptDivider} />
          <View style={[styles.heroLine, { width: "45%", alignSelf: "flex-end" }]} />
        </View>

        <View style={styles.xpBadge}>
          <MaterialCommunityIcons name="star-four-points" size={10} color={Colors.leaf} />
          <Text style={styles.xpBadgeText}>+15 XP</Text>
        </View>

        <View style={styles.leafBadge}>
          <MaterialCommunityIcons name="leaf" size={12} color="#fff" />
        </View>
      </View>
    </Animated.View>
  );
}

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
          <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.logoWrap}>
            <MaterialCommunityIcons name="leaf" size={32} color={Colors.leaf} />
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(60).springify()} style={styles.appName}>
            Leafy
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.tagline}>
            La tua spesa di ogni giorno, premiata.
          </Animated.Text>

          <HeroIllustration />

          <Animated.Text entering={FadeInDown.delay(220).springify()} style={styles.socialProof}>
            🌱 Unisciti a migliaia di esploratori green
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.card}>
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
              <Text style={styles.dividerText}>oppure continua con</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.oauthRow}>
              <Pressable
                style={({ pressed }) => [styles.oauthIconBtn, pressed && { opacity: 0.8 }]}
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
                    <Text style={styles.oauthIconLabel}>Google</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.oauthIconBtn, pressed && { opacity: 0.8 }]}
                onPress={() => handleOAuth("facebook")}
                disabled={!!oauthLoading}
              >
                {oauthLoading === "facebook" ? (
                  <ActivityIndicator color={Colors.forest} size="small" />
                ) : (
                  <>
                    <View style={styles.fbIcon}>
                      <Text style={styles.fbF}>f</Text>
                    </View>
                    <Text style={styles.oauthIconLabel}>Facebook</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={styles.terms}>
              Continuando accetti i Termini di Servizio e la Privacy Policy.
              {"\n"}Non condividiamo i tuoi dati di spesa.
            </Text>
          </Animated.View>
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
    paddingTop: 36,
    paddingBottom: 32,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  appName: {
    fontSize: 34,
    fontFamily: Fonts.displayBold,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    fontFamily: Fonts.bodyRegular,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: "center",
  },
  heroWrap: {
    width: 200,
    height: 120,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: "absolute",
    left: 14,
    top: 10,
  },
  heroReceipt: {
    position: "absolute",
    right: 10,
    top: 8,
    width: 88,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 10,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroLine: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.cardAlt,
  },
  heroReceiptDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  xpBadge: {
    position: "absolute",
    bottom: 0,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
  },
  xpBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.leaf,
  },
  leafBadge: {
    position: "absolute",
    top: 4,
    left: 58,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.mint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.background,
  },
  socialProof: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: 20,
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
    gap: 8,
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
  oauthRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  oauthIconBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: Colors.card,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    width: 24,
    height: 24,
    borderRadius: 12,
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
  oauthIconLabel: {
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
