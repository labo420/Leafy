import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightTheme, darkTheme, type ThemeColors, type ThemeMode } from "@/constants/theme";

const THEME_KEY = "leafy_theme_mode";

type ThemeContextType = {
  theme: ThemeColors;
  mode: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  mode: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "dark" || saved === "light") {
        setMode(saved);
      }
    });
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = mode === "light" ? "dark" : "light";
    setMode(next);
    AsyncStorage.setItem(THEME_KEY, next);
  };

  const theme = mode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
