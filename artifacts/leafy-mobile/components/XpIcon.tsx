import React from "react";
import { StyleProp, Text, TextStyle } from "react-native";

const XP_GOLD = "#FFD700";

interface XpIconProps {
  size?: number;
  style?: StyleProp<TextStyle>;
}

export function XpIcon({ size = 14, style }: XpIconProps) {
  return (
    <Text
      style={[
        {
          fontSize: size,
          fontFamily: "DMSans_700Bold",
          color: XP_GOLD,
          letterSpacing: 0.5,
        },
        style,
      ]}
    >
      XP
    </Text>
  );
}
