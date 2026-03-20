import { Feather, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Image,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";

type Mode = "login" | "register";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const SOCIAL_PROOF_MESSAGES = [
  { name: "Lorenzo", xp: 45, product: "pasta bio" },
  { name: "Marta", xp: 30, product: "latte vegetale" },
  { name: "Giulia", xp: 60, product: "detersivo ecologico" },
  { name: "Davide", xp: 25, product: "frutta di stagione" },
  { name: "Sara", xp: 50, product: "yogurt biologico" },
];

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC04" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}


function LeafTrail() {
  const positions = [0, 1, 2, 3, 4];
  return (
    <View style={styles.trailWrap} pointerEvents="none">
      {positions.map((i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(300 + i * 120).duration(600)}
          style={[styles.trailLeaf, { left: 14 + i * 6, top: i * 13 }]}
        >
          <MaterialCommunityIcons
            name="leaf"
            size={10 - i}
            color={Colors.leaf}
            style={{ opacity: 1 - i * 0.15 }}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function BackgroundPattern() {
  const leafPositions = [
    { top: 60, left: 20, size: 28, rot: -30, opacity: 0.06 },
    { top: 120, right: 18, size: 20, rot: 45, opacity: 0.05 },
    { top: 200, left: 40, size: 16, rot: 10, opacity: 0.04 },
    { top: 280, right: 30, size: 24, rot: -15, opacity: 0.05 },
    { top: 400, left: 10, size: 18, rot: 60, opacity: 0.04 },
    { top: 480, right: 10, size: 14, rot: -45, opacity: 0.04 },
    { top: 580, left: 30, size: 22, rot: 20, opacity: 0.05 },
    { top: 650, right: 25, size: 16, rot: -20, opacity: 0.04 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {leafPositions.map((pos, i) => (
        <MaterialCommunityIcons
          key={i}
          name="leaf"
          size={pos.size}
          color={Colors.leaf}
          style={{
            position: "absolute",
            top: pos.top,
            ...(pos.left !== undefined ? { left: pos.left } : {}),
            ...(pos.right !== undefined ? { right: pos.right } : {}),
            opacity: pos.opacity,
            transform: [{ rotate: `${pos.rot}deg` }],
          }}
        />
      ))}
    </View>
  );
}

function HeroIllustration() {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(120).springify()}
      style={[styles.heroWrap, floatStyle]}
    />
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setUser, refetch } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

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
      <BackgroundPattern />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "position"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 80}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.appNameContainer}>
            <Image
              source={require("../assets/images/logo-leafy-white.png")}
              style={styles.appNameLogo}
              resizeMode="contain"
              fadeDuration={0}
            />
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(90).springify()} style={styles.tagline}>
            La tua spesa di ogni giorno, premiata.
          </Animated.Text>

          <HeroIllustration />

          <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="leaf" size={14} color={Colors.leaf} />
              <Text style={styles.cardHeaderText}>
                Unisciti a migliaia di esploratori green
              </Text>
            </View>

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
                  onFocus={handleInputFocus}
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
                onFocus={handleInputFocus}
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
                onFocus={handleInputFocus}
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
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.7 },
              ]}
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
                    <GoogleLogo />
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
                    <FontAwesome5 name="facebook" size={18} color="#1877F2" />
                    <Text style={styles.oauthIconLabel}>Facebook</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={styles.terms}>
              Continuando accetti i Termini di Servizio e la Privacy Policy.{"\n"}
              Non condividiamo i tuoi dati di spesa.
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
    backgroundColor: "#2E6B50",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 32,
  },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  appNameContainer: {
    height: 120,
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  appNameLogo: {
    width: 280,
    height: 80,
  },
  tagline: {
    fontSize: 15,
    fontFamily: Fonts.bodyRegular,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 20,
    textAlign: "center",
  },
  heroWrap: {
    width: 230,
    height: 130,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: Colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
    position: "absolute",
    left: 10,
    top: 14,
  },
  socialCard: {
    position: "absolute",
    right: 0,
    top: 6,
    width: 120,
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  socialCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  socialCardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  socialCardLive: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    color: "#22C55E",
    letterSpacing: 0.8,
  },
  socialCardName: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.text,
    marginBottom: 1,
  },
  socialCardText: {
    fontSize: 10,
    fontFamily: Fonts.bodyRegular,
    color: Colors.textSecondary,
  },
  socialCardXp: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.leaf,
  },
  socialCardProduct: {
    fontSize: 10,
    fontFamily: Fonts.bodyRegular,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
  },
  xpBadge: {
    position: "absolute",
    bottom: 2,
    right: 8,
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
    top: 8,
    left: 68,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.mint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.background,
  },
  trailWrap: {
    width: 60,
    height: 64,
    position: "relative",
    marginBottom: 0,
    alignSelf: "flex-start",
    marginLeft: 52,
  },
  trailLeaf: {
    position: "absolute",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    alignSelf: "center",
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 20,
    gap: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 2,
  },
  cardHeaderText: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.cardAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
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
    marginTop: 2,
  },
});
