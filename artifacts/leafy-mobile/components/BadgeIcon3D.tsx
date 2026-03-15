import React, { useId } from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Circle,
  Ellipse,
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const TYPE_PALETTES: Record<string, { light: string; mid: string; dark: string; rim: string; shadow: string }> = {
  WEEKLY: {
    light: "#F9A8D4",
    mid: "#EC4899",
    dark: "#9D174D",
    rim: "#831843",
    shadow: "#6B1038",
  },
  MONTHLY: {
    light: "#FDBA74",
    mid: "#F97316",
    dark: "#C2410C",
    rim: "#9A3412",
    shadow: "#7C2D12",
  },
  SEASONAL: {
    light: "#5EEAD4",
    mid: "#14B8A6",
    dark: "#0F766E",
    rim: "#115E59",
    shadow: "#134E4A",
  },
  "PRIMA VOLTA": {
    light: "#6EE7B7",
    mid: "#10B981",
    dark: "#047857",
    rim: "#065F46",
    shadow: "#064E3B",
  },
  "PRIMA-VOLTA": {
    light: "#6EE7B7",
    mid: "#10B981",
    dark: "#047857",
    rim: "#065F46",
    shadow: "#064E3B",
  },
  PRODOTTO: {
    light: "#93C5FD",
    mid: "#3B82F6",
    dark: "#1D4ED8",
    rim: "#1E40AF",
    shadow: "#1E3A8A",
  },
  VOLUME: {
    light: "#C4B5FD",
    mid: "#8B5CF6",
    dark: "#6D28D9",
    rim: "#5B21B6",
    shadow: "#4C1D95",
  },
  LIVELLO: {
    light: "#FDE68A",
    mid: "#F59E0B",
    dark: "#B45309",
    rim: "#92400E",
    shadow: "#78350F",
  },
  STREAK: {
    light: "#FDBA74",
    mid: "#F97316",
    dark: "#C2410C",
    rim: "#9A3412",
    shadow: "#7C2D12",
  },
};

const DEFAULT_PALETTE = {
  light: "#86EFAC",
  mid: "#22C55E",
  dark: "#15803D",
  rim: "#166534",
  shadow: "#14532D",
};

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

interface BadgeIcon3DProps {
  emoji: string;
  badgeType?: string;
  category?: string;
  isUnlocked: boolean;
  size?: number;
}

export default function BadgeIcon3D({
  emoji,
  badgeType,
  category,
  isUnlocked,
  size = 64,
}: BadgeIcon3DProps) {
  const uid = useId().replace(/:/g, "");
  const typeKey = (badgeType ?? category ?? "").toUpperCase();
  const pal = isUnlocked
    ? (TYPE_PALETTES[typeKey] ?? DEFAULT_PALETTE)
    : { light: "#D4D4D4", mid: "#A3A3A3", dark: "#737373", rim: "#525252", shadow: "#404040" };

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;
  const mainR = size * 0.38;
  const innerR = size * 0.30;
  const iconSize = size * 0.32;
  const shadowOffset = size * 0.04;

  const gradIdFace = `face-${uid}`;
  const gradIdBevel = `bevel-${uid}`;
  const gradIdHighlight = `hl-${uid}`;

  const iconDef = EMOJI_ICON_MAP[emoji];

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.container, { width: size, height: size + shadowOffset }]}
    >
      <Svg
        width={size}
        height={size + shadowOffset}
        viewBox={`0 0 ${size} ${size + shadowOffset}`}
      >
        <Defs>
          <RadialGradient
            id={gradIdFace}
            cx="0.35"
            cy="0.30"
            rx="0.65"
            ry="0.65"
            fx="0.35"
            fy="0.30"
          >
            <Stop offset="0" stopColor={pal.light} stopOpacity="1" />
            <Stop offset="0.55" stopColor={pal.mid} stopOpacity="1" />
            <Stop offset="1" stopColor={pal.dark} stopOpacity="1" />
          </RadialGradient>

          <SvgLinearGradient id={gradIdBevel} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.25" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.15" />
          </SvgLinearGradient>

          <RadialGradient
            id={gradIdHighlight}
            cx="0.40"
            cy="0.25"
            rx="0.35"
            ry="0.30"
            fx="0.40"
            fy="0.25"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={isUnlocked ? "0.55" : "0.25"} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle
          cx={cx}
          cy={cy + shadowOffset}
          r={outerR}
          fill={pal.shadow}
          opacity={0.4}
        />

        <Circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill={pal.rim}
        />

        <Circle
          cx={cx}
          cy={cy}
          r={mainR}
          fill={`url(#${gradIdFace})`}
        />

        <Circle
          cx={cx}
          cy={cy}
          r={mainR}
          fill={`url(#${gradIdBevel})`}
        />

        <Circle
          cx={cx}
          cy={cy - mainR * 0.08}
          r={innerR}
          fill="none"
          stroke={isUnlocked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}
          strokeWidth={1}
        />

        <Ellipse
          cx={cx - mainR * 0.05}
          cy={cy - mainR * 0.28}
          rx={mainR * 0.45}
          ry={mainR * 0.30}
          fill={`url(#${gradIdHighlight})`}
        />
      </Svg>

      <View style={[styles.iconOverlay, { top: 0, height: size }]}>
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
          <MaterialCommunityIcons
            name="star-four-points"
            size={iconSize}
            color={isUnlocked ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
          />
        )}
      </View>

      {!isUnlocked && (
        <View style={[styles.statusBadge, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Feather name="lock" size={size * 0.15} color="#fff" />
        </View>
      )}

      {isUnlocked && (
        <View style={[styles.statusBadge, { backgroundColor: pal.dark }]}>
          <Feather name="check" size={size * 0.15} color="#fff" />
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
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
