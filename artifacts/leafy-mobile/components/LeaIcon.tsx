import React from "react";
import { Image } from "react-native";

const LEA_ASSET = require("../assets/images/lea-icon.png");

interface LeaIconProps {
  size?: number;
}

export function LeaIcon({ size = 20 }: LeaIconProps) {
  return (
    <Image
      source={LEA_ASSET}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
