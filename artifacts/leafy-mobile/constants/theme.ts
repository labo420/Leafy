export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  primaryDeep: string;
  primaryLight: string;
  primaryMuted: string;
  leaf: string;
  mint: string;
  forest: string;
  amber: string;
  red: string;
  blue: string;
  tabActive: string;
  tabInactive: string;
  modalBackground: string;
};

export const lightTheme: ThemeColors = {
  background: "#F8F9FA",
  card: "#FFFFFF",
  cardAlt: "#E3EBE0",
  border: "#D6DED3",
  text: "#1F2937",
  textSecondary: "#4A6357",
  textMuted: "#628477",
  primary: "#2E6B50",
  primaryDark: "#245A42",
  primaryDeep: "#1A4331",
  primaryLight: "#D6EFE2",
  primaryMuted: "#A0C8B5",
  leaf: "#2E6B50",
  mint: "#51B888",
  forest: "#1B2D26",
  amber: "#F4A462",
  red: "#EF4343",
  blue: "#3B82F6",
  tabActive: "#2E6B50",
  tabInactive: "#628477",
  modalBackground: "#FFFFFF",
};

export const darkTheme: ThemeColors = {
  background: "#121212",
  card: "#1E1E1E",
  cardAlt: "#2A2A2A",
  border: "#333333",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  primary: "#51B888",
  primaryDark: "#3DA070",
  primaryDeep: "#2E6B50",
  primaryLight: "#1E3328",
  primaryMuted: "#2A4D3A",
  leaf: "#51B888",
  mint: "#51B888",
  forest: "#1B2D26",
  amber: "#F4A462",
  red: "#EF4343",
  blue: "#3B82F6",
  tabActive: "#51B888",
  tabInactive: "#64748B",
  modalBackground: "#1E1E1E",
};
