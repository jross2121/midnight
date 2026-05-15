import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HOME_GOLD } from "./_styles";
import { createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { useTheme, type ThemeColors } from "./_utils/themeContext";

type MoreRoute = {
  title: string;
  meta: string;
  href: "/(tabs)/guide" | "/(tabs)/focus" | "/(tabs)/achievements" | "/(tabs)/insights" | "/(tabs)/settings";
  icon: React.ComponentProps<typeof IconSymbol>["name"];
};

type MoreGroup = {
  title: string;
  routes: MoreRoute[];
};

const MORE_GROUPS: MoreGroup[] = [
  {
    title: "Guide",
    routes: [
      {
        title: "How Midnight Works",
        meta: "Rules and terms",
        href: "/(tabs)/guide",
        icon: "star.fill",
      },
    ],
  },
  {
    title: "Action Tools",
    routes: [
      {
        title: "Focus Sprint",
        meta: "Task timer",
        href: "/(tabs)/focus",
        icon: "timer",
      },
    ],
  },
  {
    title: "Progress",
    routes: [
      {
        title: "Awards",
        meta: "Badge room",
        href: "/(tabs)/achievements",
        icon: "trophy.fill",
      },
      {
        title: "Insights",
        meta: "Current read",
        href: "/(tabs)/insights",
        icon: "chart.bar.fill",
      },
    ],
  },
  {
    title: "Controls",
    routes: [
      {
        title: "Settings",
        meta: "Theme and backups",
        href: "/(tabs)/settings",
        icon: "gearshape.fill",
      },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createMoreStyles(colors), [colors]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <View style={styles.headerIcon}>
            <IconSymbol name="ellipsis.circle.fill" size={20} color={HOME_GOLD} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>More</Text>
            <Text style={styles.subtitle}>Tools, progress, and controls</Text>
          </View>
        </View>

        <View style={styles.groupStack}>
          {MORE_GROUPS.map((group) => (
            <View key={group.title} style={styles.routeGroup}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.routeList}>
                {group.routes.map((item) => (
                  <Pressable
                    key={item.href}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.title}`}
                    onPress={() => router.push(item.href)}
                    style={({ pressed }) => [styles.routeRow, pressed && styles.routeRowPressed]}
                  >
                    <View style={styles.routeIcon}>
                      <IconSymbol name={item.icon} size={21} color={HOME_GOLD} />
                    </View>
                    <View style={styles.routeCopy}>
                      <Text style={styles.routeTitle}>{item.title}</Text>
                      <Text style={styles.routeMeta}>{item.meta}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={22} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>
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
    backgroundOpacity: 0.22,
  });

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.screen,
      paddingBottom: ui.spacing.xl * 3,
      gap: ui.spacing.sm,
    },
    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      paddingBottom: ui.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.divider, 0.72),
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.34),
      backgroundColor: withAlpha(HOME_GOLD, 0.1),
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "900",
      letterSpacing: 0,
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    groupStack: {
      gap: ui.spacing.sm,
    },
    routeGroup: {
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
    routeList: {
      gap: ui.spacing.xs,
    },
    routeRow: {
      ...tileSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      minHeight: 68,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
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
    },
    routeTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },
    routeMeta: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
      marginTop: 2,
      textTransform: "uppercase",
    },
  });
}
