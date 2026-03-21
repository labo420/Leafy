import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

interface XpIconProps {
  size?: number;
}

export function XpIcon({ size = 24 }: XpIconProps) {
  const diameter = Math.round(size * 2);
  const r = diameter / 2;
  const cx = r;
  const cy = r;
  const fontSize = Math.round(size * 0.72);
  const strokeW = Math.max(1.5, fontSize * 0.18);
  const edgeW = Math.max(2, Math.round(r * 0.15));
  const rimInset = Math.max(1.5, Math.round(r * 0.1));

  return (
    <Svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
      <Defs>
        {/* Coin body: bright gold at top → deep orange at bottom */}
        <LinearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE766" stopOpacity="1" />
          <Stop offset="0.42" stopColor="#FFA820" stopOpacity="1" />
          <Stop offset="1" stopColor="#BF5500" stopOpacity="1" />
        </LinearGradient>

        {/* Radial shine: light from top-left simulating a round surface */}
        <RadialGradient
          id="shineGrad"
          cx="38%"
          cy="28%"
          rx="62%"
          ry="62%"
          fx="38%"
          fy="28%"
        >
          <Stop offset="0" stopColor="#FFFCDC" stopOpacity="0.82" />
          <Stop offset="0.4" stopColor="#FFD040" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#FF8C00" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* 3-D edge: dark ring offset downward to simulate coin depth */}
      <Circle cx={cx} cy={cy + edgeW * 0.55} r={r - 0.5} fill="#6B2A00" />

      {/* Coin face */}
      <Circle cx={cx} cy={cy} r={r - edgeW * 0.55} fill="url(#coinGrad)" />

      {/* Radial light overlay */}
      <Circle cx={cx} cy={cy} r={r - edgeW * 0.55} fill="url(#shineGrad)" />

      {/* Inner decorative rim */}
      <Circle
        cx={cx}
        cy={cy}
        r={r - edgeW * 0.55 - rimInset}
        fill="none"
        stroke="#CC5E00"
        strokeWidth={Math.max(0.8, rimInset * 0.5)}
        strokeOpacity="0.55"
      />

      {/* Specular highlight — glossy ellipse near top-center */}
      <Ellipse
        cx={cx - r * 0.06}
        cy={cy - r * 0.4}
        rx={r * 0.35}
        ry={r * 0.12}
        fill="white"
        opacity="0.42"
      />

      {/* "XP" outline pass (dark stroke underneath for depth) */}
      <SvgText
        x={cx}
        y={cy + fontSize * 0.37}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="DMSans_700Bold"
        fontWeight="bold"
        fill="none"
        stroke="#6B2A00"
        strokeWidth={strokeW * 2.2}
        strokeLinejoin="round"
      >
        XP
      </SvgText>

      {/* "XP" white fill on top */}
      <SvgText
        x={cx}
        y={cy + fontSize * 0.37}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="DMSans_700Bold"
        fontWeight="bold"
        fill="white"
      >
        XP
      </SvgText>
    </Svg>
  );
}
