import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export interface ThemeColors {
  bg: string;
  surface: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

const DARK_COLORS: ThemeColors = {
  bg: "#18171b",
  surface: "#1f2228",
  accentPrimary: "#2fd2e3",
  accentSecondary: "#63e8a8",
  accentTertiary: "#91ed89",
  textPrimary: "#f2f6f4",
  textSecondary: "#9cc5b1",
  border: "#305d4e",
};

const LIGHT_COLORS: ThemeColors = {
  bg: "#f2faf7",
  surface: "#ffffff",
  accentPrimary: "#1fb9e7",
  accentSecondary: "#47e4c8",
  accentTertiary: "#63e8a8",
  textPrimary: "#18221f",
  textSecondary: "#5b7b6b",
  border: "#cfe7dc",
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
