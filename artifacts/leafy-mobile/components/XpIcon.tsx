import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

const XP_BLUE = "#38BDF8";

interface XpIconProps {
  size?: number;
}

export function XpIcon({ size = 14 }: XpIconProps) {
  return <MaterialCommunityIcons name="water" size={size} color={XP_BLUE} />;
}
