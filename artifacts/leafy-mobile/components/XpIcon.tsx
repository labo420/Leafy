import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, TextStyle } from "react-native";

const XP_GOLD = "#FFD700";

interface XpIconProps {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function XpIcon({ size = 14, color = XP_GOLD, style }: XpIconProps) {
  return (
    <MaterialCommunityIcons
      name="lightning-bolt"
      size={size}
      color={color}
      style={style}
    />
  );
}
