import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";

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
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.08 : 1) }],
  }));

  return (
    <Animated.View style={[styles.scanBtnOuter, animStyle]}>
      <LinearGradient
        colors={[Colors.leaf, "#23533e"]}
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

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.leaf,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.card,
          borderTopWidth: 0,
          borderTopColor: Colors.border,
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
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="light"
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "visible" }]} />
          ) : null,
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
          },
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Premi",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name="gift-outline" size={22} color={color} />
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
              <Feather name="user" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: Colors.leaf,
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
});
