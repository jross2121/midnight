import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentDim: string;
}

const DARK_COLORS: ThemeColors = {
  bg: "#080c12",
  bgCard: "#141d2a",
  bgInput: "#0a0e14",
  textPrimary: "#ffffff",
  textSecondary: "#8fa3b0",
  border: "#1f2a3c",
  accent: "#00d9ff",
  accentDim: "#0a0e14",
};

const LIGHT_COLORS: ThemeColors = {
  bg: "#f5f5f5",
  bgCard: "#ffffff",
  bgInput: "#f0f0f0",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  border: "#e0e0e0",
  accent: "#0099cc",
  accentDim: "#e8f4f8",
};

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

  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;

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
