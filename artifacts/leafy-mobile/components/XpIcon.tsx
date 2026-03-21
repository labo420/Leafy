import React from "react";
import { StyleProp, Text, TextStyle } from "react-native";

const XP_GOLD = "#FFD700";
const XP_DARK = "#B8860B";

interface XpIconProps {
  size?: number;
  style?: StyleProp<TextStyle>;
}

export function XpIcon({ size = 14, style }: XpIconProps) {
  const glowRadius = Math.max(2, Math.round(size * 0.35));
  return (
    <Text
      style={[
        {
          fontSize: size,
          fontFamily: "DMSans_700Bold",
          color: XP_GOLD,
          letterSpacing: Math.max(0.5, size * 0.06),
          textShadowColor: XP_DARK,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: glowRadius,
        },
        style,
      ]}
    >
      XP
    </Text>
  );
}
