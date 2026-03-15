import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Fonts } from "@/constants/typography";
import { useAuth } from "@/context/auth";
import { useScanReset } from "@/context/scan-reset";

const ACTIVE_GREEN = "#2E7D32";
const INACTIVE_COLOR = "#8EA99A";

function TabIcon({
  focused,
  label,
  children,
}: {
  focused: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 130 });
  }, [focused]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(46,107,80,${interpolate(progress.value, [0, 1], [0, 0.13], Extrapolation.CLAMP)})`,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.88, 1], Extrapolation.CLAMP) }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scaleX: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [4, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.tabItemWrap}>
      <Animated.View style={[styles.activeIconWrap, pillStyle]}>
        {children}
      </Animated.View>
      <Animated.Text style={[styles.tabLabel, { color: ACTIVE_GREEN }, labelStyle]}>
        {label}
      </Animated.Text>
      <Animated.View style={[styles.activeDot, dotStyle]} />
    </View>
  );
}

function FloatingScanButton({ focused }: { focused: boolean }) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 140 });
  }, [focused]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.08], Extrapolation.CLAMP) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.6], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.scanBtnOuter, scaleStyle]}>
      <Animated.View style={[styles.scanBtnGlow, glowStyle]} />
      <Animated.View style={[styles.scanBtnRing, ringStyle]} />
      <LinearGradient
        colors={["#3E9E5A", "#1E5C38"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scanBtnGradient}
      >
        <Feather name="camera" size={28} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
}

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { triggerReset } = useScanReset();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_GREEN,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: isIOS ? "transparent" : "#FFFFFF",
          borderTopWidth: 0,
          elevation: 0,
          height: 80 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          shadowColor: "#1A3D2B",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          overflow: "visible",
          display: !user ? "none" : "flex",
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={95}
              tint="light"
              style={[
                StyleSheet.absoluteFill,
                { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "#FFFFFF",
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  shadowColor: "#1A3D2B",
                  shadowOffset: { width: 0, height: -8 },
                  shadowOpacity: 0.10,
                  shadowRadius: 20,
                },
              ]}
            />
          ),
        tabBarItemStyle: {
          paddingTop: 10,
          paddingHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Home">
              <Feather name="home" size={23} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="storico"
        options={{
          title: "Storico",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Storico">
              <Feather name="list" size={23} color={color} strokeWidth={focused ? 2.5 : 1.8} />
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
            top: -22,
          },
        }}
        listeners={{
          tabPress: (e) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            triggerReset();
            if (e.target) {
              const stateName = e.target;
              if (!stateName?.includes("scan")) {
                router.navigate("/(tabs)/scan");
              }
            }
          },
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Premi",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Premi">
              <Ionicons name="gift-outline" size={23} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: "Profilo",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} label="Profilo">
              <Feather name="user" size={23} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItemWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  activeIconWrap: {
    borderRadius: 14,
    padding: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodyMedium,
    letterSpacing: 0.1,
    lineHeight: 12,
  },
  activeDot: {
    position: "absolute",
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACTIVE_GREEN,
  },
  scanBtnOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnGradient: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACTIVE_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  scanBtnRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: "rgba(46,107,80,0.35)",
  },
  scanBtnGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(46,107,80,0.12)",
  },
});
