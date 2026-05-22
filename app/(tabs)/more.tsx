import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "./_components/ScreenHeader";
import { HOME_GOLD } from "./_styles";
import { createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { useTheme, type ThemeColors } from "./_utils/themeContext";

type MoreRoute = {
  title: string;
  meta: string;
  body: string;
  href: "/(tabs)/guide" | "/(tabs)/focus" | "/(tabs)/achievements" | "/(tabs)/stats" | "/(tabs)/settings";
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  tone: string;
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
        body: "Scoring, contracts, ranks, and daily judgment rules.",
        href: "/(tabs)/guide",
        icon: "star.fill",
        tone: HOME_GOLD,
      },
    ],
  },
  {
    title: "Action Tools",
    routes: [
      {
        title: "Focus Sprint",
        meta: "Task timer",
        body: "Optional timer for locking onto one open quest.",
        href: "/(tabs)/focus",
        icon: "timer",
        tone: "#34D399",
      },
    ],
  },
  {
    title: "Progress",
    routes: [
      {
        title: "Rank",
        meta: "Player card",
        body: "Review rank, DR path, and equipped badge slots.",
        href: "/(tabs)/stats",
        icon: "star.fill",
        tone: HOME_GOLD,
      },
      {
        title: "Awards",
        meta: "Badge room",
        body: "Track earned badges and equip your player card.",
        href: "/(tabs)/achievements",
        icon: "trophy.fill",
        tone: "#F472B6",
      },
    ],
  },
  {
    title: "Controls",
    routes: [
      {
        title: "Settings",
        meta: "Theme and backups",
        body: "Reminders, archive, local data, export, and import.",
        href: "/(tabs)/settings",
        icon: "gearshape.fill",
        tone: "#8EA0B2",
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
        <ScreenHeader title="More" subtitle="Tools, progress, and controls" icon="ellipsis.circle.fill" />

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
                    <View
                      style={[
                        styles.routeIcon,
                        {
                          borderColor: withAlpha(item.tone, 0.34),
                          backgroundColor: withAlpha(item.tone, 0.1),
                        },
                      ]}
                    >
                      <IconSymbol name={item.icon} size={20} color={item.tone} />
                    </View>
                    <View style={styles.routeCopy}>
                      <View style={styles.routeTitleRow}>
                        <Text style={styles.routeTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.routeMeta, { color: item.tone }]} numberOfLines={1}>
                          {item.meta}
                        </Text>
                      </View>
                      <Text style={styles.routeBody} numberOfLines={2}>
                        {item.body}
                      </Text>
                    </View>
                    <View style={styles.routeChevron}>
                      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                    </View>
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
      flex: 1,
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
      textAlign: "right",
      flexShrink: 0,
    },
    routeBody: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    routeChevron: {
      width: 22,
      alignItems: "flex-end",
      justifyContent: "center",
      opacity: 0.72,
    },
  });
}
