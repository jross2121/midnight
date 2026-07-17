import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { HOME_GOLD } from "../_styles";
import { ui, withAlpha } from "../_utils/designSystem";
import { useTheme, type ThemeColors } from "../_utils/themeContext";

type IconSymbolName = React.ComponentProps<typeof IconSymbol>["name"];

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  icon: IconSymbolName;
  accent?: string;
  onIconPress?: () => void;
  iconAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  title,
  subtitle,
  icon,
  accent = HOME_GOLD,
  onIconPress,
  iconAccessibilityLabel,
  style,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = createScreenHeaderStyles(colors);
  const iconPlateStyle = [
    styles.iconPlate,
    {
      borderColor: withAlpha(accent, 0.32),
      backgroundColor: withAlpha(accent, 0.09),
    },
  ];

  return (
    <View style={[styles.header, style]}>
      {onIconPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={iconAccessibilityLabel}
          onPress={onIconPress}
          hitSlop={4}
          style={({ pressed }) => [iconPlateStyle, pressed && styles.iconPressed]}
        >
          <IconSymbol name={icon} size={19} color={accent} />
        </Pressable>
      ) : (
        <View style={iconPlateStyle}>
          <IconSymbol name={icon} size={19} color={accent} />
        </View>
      )}

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function createScreenHeaderStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.divider, 0.72),
    },
    iconPlate: {
      width: 44,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    iconPressed: {
      opacity: 0.76,
      transform: [{ scale: 0.992 }],
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "900",
      letterSpacing: 0,
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      letterSpacing: 0,
      marginTop: 1,
    },
  });
}
