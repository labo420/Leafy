import React from "react";
import { View, Image, StyleSheet, ImageSourcePropType } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const BADGE_IMAGES: Record<string, ImageSourcePropType> = {
  "🌱": require("@/assets/badges/badge-sprout.png"),
  "🧾": require("@/assets/badges/badge-receipt.png"),
  "📍": require("@/assets/badges/badge-map-pin.png"),
  "🐬": require("@/assets/badges/badge-dolphin.png"),
  "♻️": require("@/assets/badges/badge-recycle.png"),
  "🏃": require("@/assets/badges/badge-running.png"),
  "🥈": require("@/assets/badges/badge-silver-medal.png"),
  "🥇": require("@/assets/badges/badge-gold-medal.png"),
  "💎": require("@/assets/badges/badge-diamond.png"),
  "👥": require("@/assets/badges/badge-friends.png"),
  "🔥": require("@/assets/badges/badge-fire.png"),
  "🌊": require("@/assets/badges/badge-wave.png"),
  "🏆": require("@/assets/badges/badge-trophy.png"),
  "🌿": require("@/assets/badges/badge-leaf.png"),
  "🌍": require("@/assets/badges/badge-earth.png"),
  "📋": require("@/assets/badges/badge-receipt.png"),
  "📷": require("@/assets/badges/badge-sprout.png"),
  "🛒": require("@/assets/badges/badge-receipt.png"),
  "⭐": require("@/assets/badges/badge-gold-medal.png"),
  "🎯": require("@/assets/badges/badge-trophy.png"),
  "💧": require("@/assets/badges/badge-wave.png"),
  "🏪": require("@/assets/badges/badge-map-pin.png"),
  "🥉": require("@/assets/badges/badge-silver-medal.png"),
  "level-germoglio": require("@/assets/badges/level-germoglio.png"),
  "level-ramoscello": require("@/assets/badges/level-ramoscello.png"),
  "level-arbusto": require("@/assets/badges/level-arbusto.png"),
  "level-albero": require("@/assets/badges/level-albero.png"),
  "level-foresta": require("@/assets/badges/level-foresta.png"),
  "level-giungla": require("@/assets/badges/level-giungla.png"),
};

const FALLBACK_IMAGE = require("@/assets/badges/badge-sprout.png");

const LEVEL_NAME_TO_KEY: Record<string, string> = {
  Germoglio: "level-germoglio",
  Ramoscello: "level-ramoscello",
  Arbusto: "level-arbusto",
  Albero: "level-albero",
  Foresta: "level-foresta",
  Giungla: "level-giungla",
};

interface BadgeIcon3DProps {
  emoji: string;
  badgeType?: string;
  category?: string;
  name?: string;
  isUnlocked: boolean;
  size?: number;
}

export default function BadgeIcon3D({
  emoji,
  category,
  name,
  isUnlocked,
  size = 64,
}: BadgeIcon3DProps) {
  let imageSource: ImageSourcePropType = FALLBACK_IMAGE;
  if (category === "Livello" && name && name in LEVEL_NAME_TO_KEY) {
    imageSource = BADGE_IMAGES[LEVEL_NAME_TO_KEY[name]] ?? FALLBACK_IMAGE;
  } else {
    imageSource = BADGE_IMAGES[emoji] ?? FALLBACK_IMAGE;
  }
  const lockSize = Math.max(16, size * 0.28);

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.container, { width: size, height: size }]}
    >
      <Image
        source={imageSource}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.12,
          },
          !isUnlocked && styles.lockedImage,
        ]}
        resizeMode="contain"
      />

      {!isUnlocked && (
        <View style={[styles.lockedOverlay, { width: size, height: size, borderRadius: size * 0.12 }]}>
          <View style={[styles.lockBadge, { width: lockSize, height: lockSize, borderRadius: lockSize / 2 }]}>
            <Feather name="lock" size={lockSize * 0.5} color="#fff" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockedImage: {
    opacity: 0.35,
  },
  lockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
