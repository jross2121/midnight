import { HOME_GOLD } from "@/src/styles";
import { withAlpha } from "@/src/utils/designSystem";
import { useTheme } from "@/src/utils/themeContext";
import { AppThemeTokens } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

const PRIMARY_BUTTON_FOREGROUND = "#101722";

type AppButtonProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, "style">;

function BaseButton({
  label,
  style,
  disabled,
  variant,
  accessibilityLabel,
  accessibilityState,
  ...props
}: AppButtonProps & { variant: "primary" | "secondary" }) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary"
          ? {
              backgroundColor: HOME_GOLD,
              borderColor: HOME_GOLD,
            }
          : {
              backgroundColor: colors.surface2,
              borderColor: withAlpha(colors.border, 0.55),
            },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.label,
          {
            color: variant === "primary" ? PRIMARY_BUTTON_FOREGROUND : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton(props: AppButtonProps) {
  return <BaseButton {...props} variant="primary" />;
}

export function SecondaryButton(props: AppButtonProps) {
  return <BaseButton {...props} variant="secondary" />;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: AppThemeTokens.radius.button,
    borderWidth: AppThemeTokens.border.width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AppThemeTokens.spacing.md,
    shadowOffset: AppThemeTokens.shadow.soft.shadowOffset,
    shadowOpacity: AppThemeTokens.shadow.soft.shadowOpacity,
    shadowRadius: AppThemeTokens.shadow.soft.shadowRadius,
    elevation: AppThemeTokens.shadow.soft.elevation,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: AppThemeTokens.typography.body.fontSize,
    lineHeight: AppThemeTokens.typography.body.lineHeight,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
});
