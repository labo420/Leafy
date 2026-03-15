import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, {
  Polygon,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
} from "react-native-svg";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  "PRIMA VOLTA": ["#34D399", "#059669"],
  "PRODOTTO": ["#60A5FA", "#2563EB"],
  "VOLUME": ["#A78BFA", "#7C3AED"],
  "LIVELLO": ["#FBBF24", "#D97706"],
  "STREAK": ["#FB923C", "#EA580C"],
  "WEEKLY": ["#F472B6", "#DB2777"],
  "MONTHLY": ["#FB923C", "#EA580C"],
  "SEASONAL": ["#2DD4BF", "#0D9488"],
};

const DEFAULT_GRADIENT: [string, string] = ["#51B888", "#2E6B50"];

type IconDef =
  | { lib: "feather"; name: React.ComponentProps<typeof Feather>["name"] }
  | { lib: "mci"; name: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

const EMOJI_ICON_MAP: Record<string, IconDef> = {
  "🌱": { lib: "mci", name: "sprout" },
  "🌿": { lib: "mci", name: "leaf" },
  "📋": { lib: "feather", name: "file-text" },
  "📷": { lib: "feather", name: "camera" },
  "🧾": { lib: "feather", name: "file-text" },
  "📍": { lib: "feather", name: "map-pin" },
  "🐬": { lib: "mci", name: "dolphin" },
  "♻️": { lib: "mci", name: "recycle" },
  "🏃": { lib: "mci", name: "run" },
  "🥈": { lib: "mci", name: "medal" },
  "🥇": { lib: "mci", name: "medal" },
  "💎": { lib: "mci", name: "diamond-stone" },
  "🛒": { lib: "feather", name: "shopping-cart" },
  "⭐": { lib: "feather", name: "star" },
  "🏆": { lib: "mci", name: "trophy" },
  "🎯": { lib: "feather", name: "target" },
  "🌍": { lib: "mci", name: "earth" },
  "🔥": { lib: "mci", name: "fire" },
  "💧": { lib: "mci", name: "water" },
  "🏪": { lib: "mci", name: "store" },
  "🥉": { lib: "mci", name: "medal" },
};

function hexPoints(size: number, cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
}

interface BadgeIconProps {
  emoji: string;
  category: string;
  isUnlocked: boolean;
  size?: number;
}

export default function BadgeIcon({
  emoji,
  category,
  isUnlocked,
  size = 56,
}: BadgeIconProps) {
  const gradientKey = category.toUpperCase();
  const [color1, color2] = CATEGORY_GRADIENTS[gradientKey] ?? DEFAULT_GRADIENT;
  const cx = size / 2;
  const cy = size / 2;
  const hexRadius = size * 0.42;
  const iconSize = size * 0.36;

  const gradId = `grad-${gradientKey.replace(/\s+/g, "-")}-${size}-${isUnlocked ? "u" : "l"}`;
  const iconDef = EMOJI_ICON_MAP[emoji];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop
              offset="0"
              stopColor={isUnlocked ? color1 : "#B0B0B0"}
              stopOpacity={isUnlocked ? "1" : "0.6"}
            />
            <Stop
              offset="1"
              stopColor={isUnlocked ? color2 : "#8A8A8A"}
              stopOpacity={isUnlocked ? "1" : "0.6"}
            />
          </SvgLinearGradient>
        </Defs>

        <Circle
          cx={cx}
          cy={cy}
          r={hexRadius + 3}
          fill="none"
          stroke={isUnlocked ? color1 : "#CCCCCC"}
          strokeWidth={1.5}
          strokeOpacity={isUnlocked ? 0.3 : 0.2}
        />

        <Polygon
          points={hexPoints(hexRadius, cx, cy)}
          fill={`url(#${gradId})`}
        />
      </Svg>

      <View style={styles.iconOverlay}>
        {iconDef ? (
          iconDef.lib === "feather" ? (
            <Feather
              name={iconDef.name}
              size={iconSize}
              color={isUnlocked ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
            />
          ) : (
            <MaterialCommunityIcons
              name={iconDef.name}
              size={iconSize}
              color={isUnlocked ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
            />
          )
        ) : (
          <Text
            style={[
              styles.emojiText,
              { fontSize: iconSize * 0.85 },
              !isUnlocked && styles.emojiLocked,
            ]}
          >
            {emoji}
          </Text>
        )}
      </View>

      {!isUnlocked && (
        <View style={styles.lockBadge}>
          <Feather name="lock" size={size * 0.18} color="#fff" />
        </View>
      )}

      {isUnlocked && (
        <View style={[styles.checkBadge, { backgroundColor: color2 }]}>
          <Feather name="check" size={size * 0.16} color="#fff" />
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
  iconOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    textAlign: "center",
  },
  emojiLocked: {
    opacity: 0.5,
  },
  lockBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
