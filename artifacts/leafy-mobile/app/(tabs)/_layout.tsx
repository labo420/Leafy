import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { XpIcon } from "@/components/XpIcon";
import { LeaIcon } from "@/components/LeaIcon";
import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";
import { useScanReset } from "@/context/scan-reset";
import { useTheme } from "@/context/theme";

function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(focused ? "rgba(46,107,80,0.10)" : "rgba(46,107,80,0)", { damping: 15, stiffness: 120 }),
    transform: [{ scale: withSpring(focused ? 1 : 0.92, { damping: 15, stiffness: 120 }) }],
  }));

  return (
    <Animated.View style={[styles.activeIconWrap, pillStyle]}>
      {children}
    </Animated.View>
  );
}

function FloatingScanButton({ focused }: { focused: boolean }) {
  const { theme } = useTheme();
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.08 : 1) }],
  }));

  return (
    <Animated.View style={[styles.scanBtnOuter, animStyle, { shadowColor: theme.leaf }]}>
      <LinearGradient
        colors={[theme.leaf, "#23533e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scanBtnGradient}
      >
        <Feather name="camera" size={32} color="#fff" />
      </LinearGradient>
      {focused && <View style={styles.scanBtnRing} />}
    </Animated.View>
  );
}

function BalanceBar() {
  const { user, drops, leaBalance } = useAuth();

  if (!user) return null;

  return (
    <View style={[styles.balanceBar, { paddingTop: 4 }]}>
      <View style={styles.balanceInner}>
        <View style={styles.balanceChip}>
          <XpIcon size={16} />
          <Text style={styles.balanceChipValue}>{drops.toLocaleString("it-IT")}</Text>
        </View>
        <View style={styles.balanceDot} />
        <View style={styles.balanceChip}>
          <LeaIcon size={16} />
          <Text style={styles.balanceChipLeaLabel}>LEA</Text>
          <Text style={styles.balanceChipValue}>{Math.floor(leaBalance)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const insets = useSafeAreaInsets();
  const { user, hasLeafyGold } = useAuth();
  const { triggerReset, triggerCamera } = useScanReset();
  const { theme, mode } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        style="light"
        backgroundColor={user ? "#2E6B50" : mode === "dark" ? "#121212" : "#2E6B50"}
      />
      <View style={{ backgroundColor: user ? "#2E6B50" : undefined, paddingTop: insets.top }}>
        <BalanceBar />
      </View>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: {
          backgroundColor: isIOS ? "transparent" : theme.card,
          borderTopWidth: 0,
          elevation: 0,
          height: 84 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.05,
          shadowRadius: 20,
          overflow: "visible",
          display: !user ? "none" : "flex",
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={mode === "dark" ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]} />
          ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Fonts.bodyMedium,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingHorizontal: 4,
          gap: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Feather name="home" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="storico"
        options={{
          title: "Storico",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Feather name="list" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scansiona",
          tabBarIcon: ({ focused }) => <FloatingScanButton focused={focused} />,
          tabBarLabel: () => null,
          tabBarItemStyle: {
            top: -20,
          },
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            triggerReset();
            triggerCamera();
          },
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Feather name="credit-card" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: "Profilo",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <View>
                <Feather name="user" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
                {hasLeafyGold && (
                  <Image
                    source={require("@/assets/images/leafy-gold-icon.png")}
                    style={styles.proBadgeIcon}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TabIcon>
          ),
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceBar: {
    backgroundColor: "#2E6B50",
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  balanceInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  balanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  balanceChipValue: {
    fontSize: 32,
    fontFamily: Fonts.bodyBold,
    color: "#ffffff",
  },
  balanceChipLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodyBold,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  balanceChipLeaLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: "#AADF2A",
    letterSpacing: 0.5,
  },
  balanceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  activeIconWrap: {
    backgroundColor: "rgba(46,107,80,0.10)",
    borderRadius: 14,
    padding: 6,
  },
  scanBtnOuter: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  scanBtnGradient: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnRing: {
    position: "absolute",
    width: 85,
    height: 85,
    borderRadius: 42.5,
    borderWidth: 3,
    borderColor: "rgba(46,107,80,0.20)",
  },
  proBadgeIcon: {
    position: "absolute",
    bottom: -6,
    right: -8,
    width: 18,
    height: 18,
  },
});
