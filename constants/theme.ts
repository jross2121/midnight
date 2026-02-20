import { midnightTokens } from '@/src/theme/tokens';
import { Platform } from 'react-native';

export const AppThemeTokens = {
  spacing: {
    xxs: midnightTokens.spacing.s0,
    xs: midnightTokens.spacing.s1,
    sm: midnightTokens.spacing.s2,
    md: midnightTokens.spacing.s2,
    lg: midnightTokens.spacing.s3,
    xl: midnightTokens.spacing.s4,
    screen: midnightTokens.spacing.s2,
    card: midnightTokens.spacing.s2,
    section: midnightTokens.spacing.s3,
  },
  radius: {
    sm: midnightTokens.radius.r1,
    md: midnightTokens.radius.r2,
    button: midnightTokens.radius.r2,
    card: midnightTokens.radius.r3,
    lg: midnightTokens.radius.r3,
    xl: midnightTokens.radius.r3,
  },
  typography: {
    title: {
      ...midnightTokens.typography.h2,
    },
    heading: {
      ...midnightTokens.typography.h2,
    },
    body: {
      ...midnightTokens.typography.body,
    },
    caption: {
      ...midnightTokens.typography.label,
    },
    drHero: {
      ...midnightTokens.typography.h1,
      fontSize: 64,
      lineHeight: 68,
    },
  },
  border: {
    width: 1,
    widthStrong: 1,
    opacityCard: 0.42,
    opacitySecondary: 0.3,
  },
  motion: {
    subtle: 160,
    standard: 220,
  },
  shadow: {
    soft: {
      ...midnightTokens.shadows.subtle,
    },
    lift: {
      ...midnightTokens.shadows.raised,
    },
  },
} as const;

export const AppThemeColors = {
  dark: {
    bg: midnightTokens.colors.dark.bg0,
    surface: midnightTokens.colors.dark.bg1,
    surface2: midnightTokens.colors.dark.surface,
    border: midnightTokens.colors.dark.border,
    cardBorder: 'rgba(142, 160, 178, 0.26)',
    divider: 'rgba(142, 160, 178, 0.2)',
    text: midnightTokens.colors.dark.textPrimary,
    mutedText: midnightTokens.colors.dark.textSecondary,
    textTertiary: 'rgba(142, 160, 178, 0.72)',
    accentCyan: midnightTokens.colors.dark.accent,
    accentGreen: midnightTokens.colors.dark.positive,
    negative: midnightTokens.colors.dark.negative,
  },
  light: {
    bg: midnightTokens.colors.light.bg0,
    surface: midnightTokens.colors.light.bg1,
    surface2: midnightTokens.colors.light.surface,
    border: midnightTokens.colors.light.border,
    cardBorder: 'rgba(15, 23, 42, 0.10)',
    divider: 'rgba(15, 23, 42, 0.08)',
    text: midnightTokens.colors.light.textPrimary,
    mutedText: 'rgba(15, 23, 42, 0.62)',
    textTertiary: 'rgba(15, 23, 42, 0.48)',
    accentCyan: midnightTokens.colors.light.accent,
    accentGreen: midnightTokens.colors.light.positive,
    negative: midnightTokens.colors.light.negative,
  },
} as const;

export const Colors = {
  light: {
    text: AppThemeColors.light.text,
    background: AppThemeColors.light.bg,
    tint: AppThemeColors.light.accentCyan,
    icon: AppThemeColors.light.mutedText,
    tabIconDefault: AppThemeColors.light.mutedText,
    tabIconSelected: AppThemeColors.light.accentCyan,
  },
  dark: {
    text: AppThemeColors.dark.text,
    background: AppThemeColors.dark.bg,
    tint: AppThemeColors.dark.accentCyan,
    icon: AppThemeColors.dark.mutedText,
    tabIconDefault: AppThemeColors.dark.mutedText,
    tabIconSelected: AppThemeColors.dark.accentCyan,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
