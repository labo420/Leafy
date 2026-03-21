import React from "react";
import { Image } from "react-native";

const DROP_ASSET = require("../assets/images/drop-xp.png");

interface XpIconProps {
  size?: number;
}

export function XpIcon({ size = 20 }: XpIconProps) {
  return (
    <Image
      source={DROP_ASSET}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
