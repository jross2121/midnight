import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  defaultAchievements,
  defaultCategories,
  defaultDisciplineRating,
  defaultDrHistory,
  defaultQuests,
} from "./_utils/defaultData";
import { localDateKey } from "./_utils/dateHelpers";
import { createCardSurface, createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { buildStreakSummary } from "./_utils/planning";
import { getScheduledQuestsForDate } from "./_utils/recurrence";
import { getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme, type ThemeColors } from "./_utils/themeContext";
import type { Achievement, Category, DrHistoryEntry, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

type AchievementProgress = {
  current: number;
  target: number;
  label: string;
};

function isAchievement(value: unknown): value is Achievement {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Achievement>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.icon === "string" &&
    (typeof candidate.unlockedAt === "string" || candidate.unlockedAt === null)
  );
}

function mergeAchievements(saved: unknown): Achievement[] {
  if (!Array.isArray(saved)) return defaultAchievements;
  const savedById = new Map(saved.filter(isAchievement).map((item) => [item.id, item]));

  return defaultAchievements.map((achievement) => ({
    ...achievement,
    unlockedAt: savedById.get(achievement.id)?.unlockedAt ?? achievement.unlockedAt,
  }));
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function clampProgress(current: number, target: number): AchievementProgress {
  const safeTarget = Math.max(1, Math.floor(target));
  const safeCurrent = Math.max(0, Math.min(safeTarget, Math.floor(current)));
  return {
    current: safeCurrent,
    target: safeTarget,
    label: `${safeCurrent}/${safeTarget}`,
  };
}

function getTodayXp(todaysQuests: Quest[]): number {
  return todaysQuests
    .filter((quest) => quest.done)
    .reduce((sum, quest) => sum + quest.xp, 0);
}

function getAchievementProgress({
  achievement,
  categories,
  quests,
  drHistory,
  disciplineRating,
  lifetimeCompletedQuestCount,
}: {
  achievement: Achievement;
  categories: Category[];
  quests: Quest[];
  drHistory: DrHistoryEntry[];
  disciplineRating: number;
  lifetimeCompletedQuestCount: number;
}): AchievementProgress {
  const todaysQuests = getScheduledQuestsForDate(quests, localDateKey());
  const doneQuests = todaysQuests.filter((quest) => quest.done);
  const contractQuests = todaysQuests.filter((quest) => quest.contract);
  const completedContracts = contractQuests.filter((quest) => quest.done).length;
  const streakSummary = buildStreakSummary(drHistory);

  switch (achievement.id) {
    case "first_quest":
      return clampProgress(lifetimeCompletedQuestCount, 1);
    case "level_5":
      return clampProgress(Math.max(...categories.map((category) => category.level), 0), 5);
    case "hard_mode":
      return clampProgress(doneQuests.some((quest) => quest.difficulty === "hard") ? 1 : 0, 1);
    case "100_xp":
      return clampProgress(getTodayXp(todaysQuests), 100);
    case "all_categories":
      return clampProgress(
        categories.filter((category) => category.level >= 3).length,
        categories.length || 1
      );
    case "perfect_day":
      return clampProgress(doneQuests.length, Math.max(1, todaysQuests.length));
    case "30_quests":
      return clampProgress(lifetimeCompletedQuestCount, 30);
    case "first_contract":
      return clampProgress(completedContracts, Math.max(1, contractQuests.length));
    case "three_solid_days":
      return clampProgress(streakSummary.solidDayStreak, 3);
    case "comeback_day":
      return clampProgress(drHistory.some((entry) => (entry.comebackBonus ?? 0) > 0) ? 1 : 0, 1);
    case "rank_climber":
      return clampProgress(getRankMeta(getRankFromDR(disciplineRating)).tier, 2);
    default:
      return clampProgress(achievement.unlockedAt ? 1 : 0, 1);
  }
}

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createAchievementStyles(colors), [colors]);
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [disciplineRating, setDisciplineRating] = useState(defaultDisciplineRating);
  const [lifetimeCompletedQuestCount, setLifetimeCompletedQuestCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredState>;
      setAchievements(mergeAchievements(parsed.achievements));
      setCategories(
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : defaultCategories
      );
      setQuests(Array.isArray(parsed.quests) ? parsed.quests : defaultQuests);
      setDrHistory(Array.isArray(parsed.drHistory) ? parsed.drHistory : defaultDrHistory);
      setDisciplineRating(
        typeof parsed.disciplineRating === "number"
          ? parsed.disciplineRating
          : defaultDisciplineRating
      );
      setLifetimeCompletedQuestCount(
        typeof parsed.lifetimeCompletedQuestCount === "number"
          ? Math.max(0, Math.floor(parsed.lifetimeCompletedQuestCount))
          : 0
      );
    } catch (error) {
      console.log("Failed to load achievements:", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const enrichedAchievements = useMemo(
    () =>
      achievements.map((achievement) => {
        const progress = getAchievementProgress({
          achievement,
          categories,
          quests,
          drHistory,
          disciplineRating,
          lifetimeCompletedQuestCount,
        });
        const pct = achievement.unlockedAt
          ? 100
          : Math.round((progress.current / progress.target) * 100);
        return { achievement, progress, pct };
      }),
    [achievements, categories, disciplineRating, drHistory, lifetimeCompletedQuestCount, quests]
  );

  if (!hydrated) return null;

  const unlockedCount = achievements.filter((achievement) => achievement.unlockedAt).length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const nextUnlocks = enrichedAchievements
    .filter((item) => !item.achievement.unlockedAt)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <View style={styles.headerIcon}>
            <IconSymbol name="trophy.fill" size={18} color={colors.accentPrimary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Awards</Text>
            <Text style={styles.subtitle}>Milestones, streak marks, and earned proof</Text>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.eyebrow}>Collection</Text>
              <Text style={styles.heroTitle}>{unlockedCount}/{totalCount} unlocked</Text>
            </View>
            <Text style={styles.heroPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.heroMeta}>
            Lifetime completions: {lifetimeCompletedQuestCount}
          </Text>
        </View>

        {nextUnlocks.length > 0 ? (
          <View style={styles.nextPanel}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.eyebrow}>Next Unlocks</Text>
                <Text style={styles.sectionTitle}>Closest awards</Text>
              </View>
            </View>
            {nextUnlocks.map(({ achievement, progress, pct }) => (
              <View key={achievement.id} style={styles.nextRow}>
                <Text style={styles.nextIcon}>{achievement.icon}</Text>
                <View style={styles.nextMain}>
                  <Text style={styles.nextName}>{achievement.name}</Text>
                  <Text style={styles.nextMeta}>{achievement.description}</Text>
                  <View style={styles.smallProgressTrack}>
                    <View style={[styles.smallProgressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
                <Text style={styles.nextProgress}>{progress.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.awardGrid}>
          {enrichedAchievements.map(({ achievement, progress, pct }) => {
            const unlocked = Boolean(achievement.unlockedAt);
            return (
              <View
                key={achievement.id}
                style={[
                  styles.awardCard,
                  unlocked ? styles.awardCardUnlocked : styles.awardCardLocked,
                ]}
              >
                <View style={styles.awardTopRow}>
                  <Text style={[styles.awardIcon, !unlocked && styles.awardIconLocked]}>
                    {achievement.icon}
                  </Text>
                  <Text style={[styles.awardState, unlocked && styles.awardStateUnlocked]}>
                    {unlocked ? "Unlocked" : progress.label}
                  </Text>
                </View>
                <Text style={styles.awardName}>{achievement.name}</Text>
                <Text style={styles.awardDescription}>{achievement.description}</Text>
                <View style={styles.smallProgressTrack}>
                  <View style={[styles.smallProgressFill, { width: `${unlocked ? 100 : pct}%` }]} />
                </View>
                <Text style={styles.awardDate}>
                  {achievement.unlockedAt ? formatDate(achievement.unlockedAt) : "In progress"}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createAchievementStyles(colors: ThemeColors) {
  const cardSurface = createCardSurface(colors, {
    padding: ui.spacing.md,
    radius: ui.radius.card,
    borderOpacity: 0.22,
    backgroundColor: withAlpha(colors.surface2, 0.8),
  });
  const tileSurface = createTileSurface(colors, {
    padding: ui.spacing.sm,
    radius: ui.radius.md,
    borderOpacity: 0.2,
    backgroundOpacity: 0.2,
  });

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.md,
      paddingBottom: ui.spacing.xl * 3 + ui.spacing.lg,
      gap: ui.spacing.sm,
    },
    pageHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
      paddingBottom: ui.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.divider, 0.62),
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: ui.radius.button,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.24),
      backgroundColor: withAlpha(colors.accentPrimary, 0.075),
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "900",
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 3,
    },
    heroPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(colors.accentPrimary, 0.22),
      backgroundColor: withAlpha(colors.surface2, 0.9),
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    eyebrow: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.75,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 26,
      lineHeight: 31,
      fontWeight: "900",
      marginTop: 2,
    },
    heroPercent: {
      color: colors.accentPrimary,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: "900",
    },
    progressTrack: {
      height: 11,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.72),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.accentPrimary,
    },
    heroMeta: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      letterSpacing: 0.25,
      textTransform: "uppercase",
    },
    nextPanel: {
      ...cardSurface,
      gap: ui.spacing.xs,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "900",
      marginTop: 1,
    },
    nextRow: {
      ...tileSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
    },
    nextIcon: {
      color: colors.accentPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      width: 34,
      textAlign: "center",
    },
    nextMain: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    nextName: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    nextMeta: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
    },
    nextProgress: {
      color: colors.accentPrimary,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    awardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: ui.spacing.xs,
    },
    awardCard: {
      ...tileSurface,
      width: "48.8%",
      minHeight: 154,
      gap: 7,
    },
    awardCardUnlocked: {
      borderColor: withAlpha(colors.accentPrimary, 0.3),
      backgroundColor: withAlpha(colors.accentPrimary, 0.08),
    },
    awardCardLocked: {
      opacity: 0.76,
    },
    awardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
    },
    awardIcon: {
      color: colors.accentPrimary,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
    },
    awardIconLocked: {
      color: withAlpha(colors.textSecondary, 0.72),
    },
    awardState: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    awardStateUnlocked: {
      color: colors.accentPrimary,
    },
    awardName: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    awardDescription: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      flex: 1,
    },
    smallProgressTrack: {
      height: 7,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.78),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.18),
      overflow: "hidden",
    },
    smallProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.accentPrimary,
    },
    awardDate: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0.25,
      textTransform: "uppercase",
    },
  });
}
