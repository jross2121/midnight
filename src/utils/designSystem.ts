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
    mono: {
      ...(AppThemeTokens.typography.body as TextStyle),
      fontFamily: "monospace",
      fontWeight: "700",
    } as TextStyle,
    drHero: AppThemeTokens.typography.drHero as TextStyle,
  },
} as const;

function normalizeHex(hexColor: string): string | null {
  const color = hexColor.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return null;
}

export function withAlpha(hexColor: string, opacity: number): string {
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  const rgbaMatch = hexColor
    .trim()
    .match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);

  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
  }

  const normalized = normalizeHex(hexColor) ?? "#000000";
  const alpha = Math.round(clampedOpacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${alpha}`;
}

export function createGlow(_colors: ThemeColors, glowOpacity = 0.03): ViewStyle {
  return {
    shadowColor: "#000000",
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
    backgroundColor: options?.backgroundColor ?? withAlpha(colors.surface2, 0.9),
    borderRadius: options?.radius ?? ui.radius.card,
    borderWidth: ui.border.width,
    borderColor: withAlpha(colors.border, options?.borderOpacity ?? ui.border.opacityCard),
    padding: options?.padding ?? ui.spacing.card,
    ...createGlow(colors, options?.glowOpacity ?? 0.025),
  };
}

export function createTileSurface(
  colors: ThemeColors,
  options?: {
    padding?: number;
    radius?: number;
    borderOpacity?: number;
    backgroundOpacity?: number;
    backgroundColor?: string;
  }
): ViewStyle {
  return {
    backgroundColor: options?.backgroundColor ?? withAlpha(colors.bg, options?.backgroundOpacity ?? 0.24),
    borderRadius: options?.radius ?? ui.radius.md,
    borderWidth: ui.border.width,
    borderColor: withAlpha(colors.border, options?.borderOpacity ?? 0.22),
    padding: options?.padding ?? ui.spacing.sm,
  };
}
