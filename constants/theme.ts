import { Platform } from 'react-native';

export const AppThemeTokens = {
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    screen: 20,
    card: 18,
    section: 18,
  },
  radius: {
    sm: 10,
    md: 12,
    button: 16,
    card: 18,
    lg: 18,
    xl: 20,
  },
  typography: {
    title: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800' as const,
      letterSpacing: 0.2,
    },
    heading: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700' as const,
      letterSpacing: 0.15,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '500' as const,
    },
    caption: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600' as const,
      letterSpacing: 0.12,
    },
    drHero: {
      fontSize: 60,
      lineHeight: 64,
      fontWeight: '900' as const,
      letterSpacing: 0.35,
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
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 1,
    },
    lift: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 2,
    },
  },
} as const;

export const AppThemeColors = {
  dark: {
    bg: '#0e1318',
    surface: '#151b22',
    surface2: '#1b242d',
    border: '#2a3844',
    text: '#e8f0f4',
    mutedText: '#8ea1b2',
    accentCyan: '#2fd2e3',
    accentGreen: '#63e8a8',
  },
  light: {
    bg: '#f3f7fb',
    surface: '#ffffff',
    surface2: '#edf3f8',
    border: '#d7e2ec',
    text: '#14202b',
    mutedText: '#5e7386',
    accentCyan: '#1fb9e7',
    accentGreen: '#47d9a6',
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
