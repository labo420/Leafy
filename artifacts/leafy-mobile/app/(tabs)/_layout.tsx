import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { Fonts } from "@/constants/typography";

function FloatingScanButton({ focused }: { focused: boolean }) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.05 : 1) }],
  }));

  return (
    <Animated.View style={[styles.scanBtnOuter, animStyle]}>
      <LinearGradient
        colors={[Colors.leaf, "#23533e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scanBtnGradient}
      >
        <Feather name="camera" size={26} color="#fff" />
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
          height: 80 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.05,
          shadowRadius: 20,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="light"
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }]}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]} />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Fonts.bodyMedium,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Feather name="home" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="storico"
        options={{
          title: "Storico",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Feather name="list" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
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
            top: -16,
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
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name="gift-outline" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: "Profilo",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Feather name="user" size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scanBtnGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnRing: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "rgba(46,107,80,0.20)",
  },
});
