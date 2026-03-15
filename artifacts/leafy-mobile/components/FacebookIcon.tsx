import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

interface Props {
  size?: number;
}

export function FacebookIcon({ size = 20 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width={48} height={48} rx={6} fill="#1877F2" />
      <Path
        fill="#FFFFFF"
        d="M33.2 10H28c-5.5 0-9 3.6-9 9v4.2H14v6.3h5V38h6.3V29.5h5l1-6.3h-6v-3.5c0-1.8.9-3.5 3.5-3.5h3.5V10h-.1z"
      />
    </Svg>
  );
}
