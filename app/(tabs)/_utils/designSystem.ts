import { AppThemeTokens } from "@/constants/theme";
import type { TextStyle, ViewStyle } from "react-native";
import type { ThemeColors } from "./themeContext";

export const ui = {
  ...AppThemeTokens,
  typography: {
    title: AppThemeTokens.typography.title as TextStyle,
    heading: AppThemeTokens.typography.heading as TextStyle,
    body: AppThemeTokens.typography.body as TextStyle,
    caption: AppThemeTokens.typography.caption as TextStyle,
    drHero: AppThemeTokens.typography.drHero as TextStyle,
  },
} as const;

function normalizeHex(hexColor: string): string {
  const color = hexColor.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return "#000000";
}

export function withAlpha(hexColor: string, opacity: number): string {
  const normalized = normalizeHex(hexColor);
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${alpha}`;
}

export function createGlow(colors: ThemeColors, glowOpacity = 0.08): ViewStyle {
  return {
    shadowColor: colors.text,
    shadowOffset: ui.shadow.soft.shadowOffset,
    shadowOpacity: glowOpacity,
    shadowRadius: ui.shadow.soft.shadowRadius,
    elevation: ui.shadow.soft.elevation,
  };
}

export function createCardSurface(
  colors: ThemeColors,
  options?: {
    padding?: number;
    radius?: number;
    borderOpacity?: number;
    glowOpacity?: number;
    backgroundColor?: string;
  }
): ViewStyle {
  return {
    backgroundColor: options?.backgroundColor ?? colors.surface,
    borderRadius: options?.radius ?? ui.radius.card,
    borderWidth: ui.border.width,
    borderColor: withAlpha(colors.border, options?.borderOpacity ?? ui.border.opacityCard),
    padding: options?.padding ?? ui.spacing.card,
    ...createGlow(colors, options?.glowOpacity ?? 0.08),
  };
}
