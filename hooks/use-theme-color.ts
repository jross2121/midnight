/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useTheme } from '@/app/(tabs)/utils/themeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName:
    | 'text'
    | 'background'
    | 'tint'
    | 'icon'
    | 'tabIconDefault'
    | 'tabIconSelected'
) {
  const { theme, colors } = useTheme();
  const colorFromProps = props[theme];

  if (colorFromProps) return colorFromProps;

  const map = {
    text: colors.textPrimary,
    background: colors.bg,
    tint: colors.accentPrimary,
    icon: colors.textSecondary,
    tabIconDefault: colors.textSecondary,
    tabIconSelected: colors.accentPrimary,
  };

  return map[colorName] ?? colors.textPrimary;
}
