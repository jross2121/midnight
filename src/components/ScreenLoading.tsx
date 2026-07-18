import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HOME_GOLD } from "@/src/styles";
import { ui, withAlpha } from "@/src/utils/designSystem";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";

type ScreenLoadingProps = {
  label: string;
};

export function ScreenLoading({ label }: ScreenLoadingProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.content} accessibilityRole="progressbar" accessibilityLabel={label}>
        <ActivityIndicator size="small" color={HOME_GOLD} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: ui.spacing.xs,
      padding: ui.spacing.lg,
    },
    label: {
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
    },
  });
}
