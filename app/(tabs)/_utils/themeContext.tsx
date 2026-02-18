import { AppThemeColors } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  mutedText: string;
  accentCyan: string;
  accentGreen: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

function createThemeColors(mode: Theme): ThemeColors {
  const base = mode === "dark" ? AppThemeColors.dark : AppThemeColors.light;

  return {
    bg: base.bg,
    surface: base.surface,
    surface2: base.surface2,
    text: base.text,
    mutedText: base.mutedText,
    accentCyan: base.accentCyan,
    accentGreen: base.accentGreen,
    accentPrimary: base.accentCyan,
    accentSecondary: base.accentGreen,
    accentTertiary: base.accentGreen,
    textPrimary: base.text,
    textSecondary: base.mutedText,
    border: base.border,
  };
}

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);

  // Load theme from storage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("app:theme");
        if (saved === "light" || saved === "dark") {
          setTheme(saved);
        }
      } catch (e) {
        console.log("Failed to load theme:", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem("app:theme", newTheme);
    } catch (e) {
      console.log("Failed to save theme:", e);
    }
  };

  if (!hydrated) {
    return null;
  }

  const colors = createThemeColors(theme);

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
