import React from "react";
import { Text, View } from "react-native";

const XP_GOLD = "#FFD700";
const XP_DARK = "#B8860B";

const STROKE_DIRECTIONS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],           [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

interface XpIconProps {
  size?: number;
}

export function XpIcon({ size = 14 }: XpIconProps) {
  const strokeSize = Math.max(1, Math.round(size * 0.12));
  const textStyle = {
    fontSize: size,
    fontFamily: "DMSans_700Bold",
    letterSpacing: Math.max(0.5, size * 0.06),
  } as const;

  return (
    <View style={{ position: "relative" }}>
      {STROKE_DIRECTIONS.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[
            textStyle,
            {
              color: XP_DARK,
              position: "absolute",
              left: dx * strokeSize,
              top: dy * strokeSize,
            },
          ]}
        >
          XP
        </Text>
      ))}
      <Text style={[textStyle, { color: XP_GOLD }]}>XP</Text>
    </View>
  );
}
