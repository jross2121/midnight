import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { HOME_GOLD } from "@/src/styles";
import { createTileSurface, ui, withAlpha } from "@/src/utils/designSystem";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";

type MoreRoute = {
  title: string;
  meta: string;
  body: string;
  href: "/(tabs)/guide" | "/(tabs)/focus" | "/(tabs)/achievements" | "/(tabs)/stats" | "/(tabs)/settings";
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  tone: string;
};

const MORE_ROUTES: MoreRoute[] = [
  {
    title: "Focus Sprint",
    meta: "Timer",
    body: "Work on one open quest.",
    href: "/(tabs)/focus",
    icon: "timer",
    tone: "#34D399",
  },
  {
    title: "Player Card",
    meta: "Rank",
    body: "Your rank and equipped awards.",
    href: "/(tabs)/stats",
    icon: "star.fill",
    tone: HOME_GOLD,
  },
  {
    title: "Awards",
    meta: "Milestones",
    body: "Milestones you earn and equip.",
    href: "/(tabs)/achievements",
    icon: "trophy.fill",
    tone: "#F472B6",
  },
  {
    title: "How it works",
    meta: "Guide",
    body: "Midnight rules in plain language.",
    href: "/(tabs)/guide",
    icon: "star.fill",
    tone: "#60A5FA",
  },
  {
    title: "Settings",
    meta: "Account",
    body: "Reminders, appearance, archive, and backups.",
    href: "/(tabs)/settings",
    icon: "gearshape.fill",
    tone: "#8EA0B2",
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createMoreStyles(colors), [colors]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title="More" subtitle="Focus, milestones, help, and settings" icon="ellipsis.circle.fill" />

        <View style={styles.quickGrid}>
          {MORE_ROUTES.slice(0, 4).map((item) => (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [
                styles.quickTile,
                { borderColor: withAlpha(item.tone, 0.26) },
                pressed && styles.routeRowPressed,
              ]}
            >
              <View style={[styles.routeIcon, { borderColor: withAlpha(item.tone, 0.34), backgroundColor: withAlpha(item.tone, 0.1) }]}>
                <IconSymbol name={item.icon} size={21} color={item.tone} />
              </View>
              <Text style={[styles.routeMeta, { color: item.tone }]}>{item.meta}</Text>
              <Text style={styles.routeTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.routeBody} numberOfLines={2}>{item.body}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.appSection}>
          <Text style={styles.groupTitle}>App</Text>
          {MORE_ROUTES.slice(4).map((item) => (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [styles.routeRow, pressed && styles.routeRowPressed]}
            >
              <View style={[styles.routeIcon, { borderColor: withAlpha(item.tone, 0.34), backgroundColor: withAlpha(item.tone, 0.1) }]}>
                <IconSymbol name={item.icon} size={20} color={item.tone} />
              </View>
              <View style={styles.routeCopy}>
                <Text style={styles.routeTitle}>{item.title}</Text>
                <Text style={styles.routeBody} numberOfLines={2}>{item.body}</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createMoreStyles(colors: ThemeColors) {
  const tileSurface = createTileSurface(colors, {
    padding: ui.spacing.sm,
    radius: ui.radius.md,
    borderOpacity: 0.22,
    backgroundOpacity: 0.2,
  });

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.screen,
      paddingBottom: ui.spacing.lg,
      gap: ui.spacing.sm,
    },
    quickGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: ui.spacing.xs,
    },
    appSection: {
      gap: ui.spacing.xs,
    },
    groupTitle: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      paddingHorizontal: 2,
    },
    quickTile: {
      ...tileSurface,
      width: "48%",
      flexGrow: 1,
      minWidth: 130,
      minHeight: 154,
      padding: ui.spacing.sm,
      backgroundColor: withAlpha(colors.surface2, 0.58),
      alignItems: "flex-start",
      gap: 4,
    },
    routeRow: {
      ...tileSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      minHeight: 76,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
      backgroundColor: withAlpha(colors.surface2, 0.58),
    },
    routeRowPressed: {
      opacity: 0.76,
      transform: [{ scale: 0.992 }],
    },
    routeIcon: {
      width: 42,
      height: 42,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.32),
      backgroundColor: withAlpha(HOME_GOLD, 0.1),
    },
    routeCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    routeTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
    },
    routeTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },
    routeMeta: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
      marginTop: 6,
    },
    routeBody: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
  });
}
