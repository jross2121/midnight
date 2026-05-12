import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

type IconSymbolName = React.ComponentProps<typeof IconSymbol>["name"];

type AchievementProgress = {
  current: number;
  target: number;
  label: string;
};

type AwardCollectionId =
  | "all"
  | "quests"
  | "contracts"
  | "streaks"
  | "rank"
  | "mastery"
  | "rare";

type AwardRarity = "Core" | "Advanced" | "Elite";

type AwardMeta = {
  collection: Exclude<AwardCollectionId, "all">;
  rarity: AwardRarity;
  hint: string;
};

type AwardVisual = {
  icon: IconSymbolName;
  primary: string;
  soft: string;
  deep: string;
  label: string;
};

type EnrichedAchievement = {
  achievement: Achievement;
  progress: AchievementProgress;
  pct: number;
  unlocked: boolean;
  ready: boolean;
  meta: AwardMeta;
};

const COLLECTIONS: { id: AwardCollectionId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "quests", label: "Quests" },
  { id: "contracts", label: "Contracts" },
  { id: "streaks", label: "Streaks" },
  { id: "rank", label: "Rank" },
  { id: "mastery", label: "Mastery" },
  { id: "rare", label: "Rare" },
];

const AWARD_META: Record<string, AwardMeta> = {
  first_quest: {
    collection: "quests",
    rarity: "Core",
    hint: "Finish any open quest.",
  },
  quest_10: {
    collection: "quests",
    rarity: "Core",
    hint: "Keep stacking daily completions.",
  },
  "30_quests": {
    collection: "quests",
    rarity: "Advanced",
    hint: "Clear quests across several days.",
  },
  quest_100: {
    collection: "quests",
    rarity: "Elite",
    hint: "This is a long-run consistency trophy.",
  },
  hard_mode: {
    collection: "quests",
    rarity: "Core",
    hint: "Complete one hard quest.",
  },
  double_hard: {
    collection: "quests",
    rarity: "Advanced",
    hint: "Clear two hard quests before midnight.",
  },
  "100_xp": {
    collection: "quests",
    rarity: "Core",
    hint: "Complete enough XP today to cross 100.",
  },
  xp_150: {
    collection: "quests",
    rarity: "Advanced",
    hint: "Push today's completed XP to 150.",
  },
  xp_200: {
    collection: "rare",
    rarity: "Elite",
    hint: "A heavy XP day. Contracts and hard quests help.",
  },
  perfect_day: {
    collection: "quests",
    rarity: "Advanced",
    hint: "Complete every quest scheduled today.",
  },
  perfect_3: {
    collection: "rare",
    rarity: "Elite",
    hint: "Record three perfect midnight judgments.",
  },
  balanced_day: {
    collection: "mastery",
    rarity: "Advanced",
    hint: "Complete quests from four different categories today.",
  },
  level_5: {
    collection: "mastery",
    rarity: "Core",
    hint: "Push one category to level 5.",
  },
  level_10: {
    collection: "mastery",
    rarity: "Elite",
    hint: "Specialize one category to level 10.",
  },
  all_categories: {
    collection: "mastery",
    rarity: "Advanced",
    hint: "Raise every category to level 3.",
  },
  all_categories_5: {
    collection: "mastery",
    rarity: "Elite",
    hint: "Raise every category to level 5.",
  },
  first_contract: {
    collection: "contracts",
    rarity: "Core",
    hint: "Protect all active contracts today.",
  },
  contract_3: {
    collection: "contracts",
    rarity: "Advanced",
    hint: "Protect contracts for three judgment days in a row.",
  },
  contract_7: {
    collection: "contracts",
    rarity: "Elite",
    hint: "Protect contracts for a full week.",
  },
  contract_14: {
    collection: "contracts",
    rarity: "Elite",
    hint: "Protect contracts for fourteen judgment days.",
  },
  three_solid_days: {
    collection: "streaks",
    rarity: "Core",
    hint: "Reach 60%+ for three judgments in a row.",
  },
  solid_7: {
    collection: "streaks",
    rarity: "Advanced",
    hint: "Reach 60%+ for seven judgments in a row.",
  },
  solid_14: {
    collection: "streaks",
    rarity: "Elite",
    hint: "Reach 60%+ for fourteen judgments in a row.",
  },
  comeback_day: {
    collection: "rare",
    rarity: "Advanced",
    hint: "Recover after a weaker previous signal.",
  },
  rank_climber: {
    collection: "rank",
    rarity: "Core",
    hint: "Reach Consistent rank.",
  },
  rank_focused: {
    collection: "rank",
    rarity: "Advanced",
    hint: "Reach Focused rank.",
  },
  rank_driven: {
    collection: "rank",
    rarity: "Advanced",
    hint: "Reach Driven rank.",
  },
  rank_relentless: {
    collection: "rank",
    rarity: "Elite",
    hint: "Reach Relentless rank.",
  },
  rank_elite: {
    collection: "rank",
    rarity: "Elite",
    hint: "Reach Elite rank.",
  },
  rank_grand: {
    collection: "rare",
    rarity: "Elite",
    hint: "Reach Grand Discipline rank.",
  },
};

const FALLBACK_AWARD_META: AwardMeta = {
  collection: "quests",
  rarity: "Core",
  hint: "Keep completing quests to reveal this trophy.",
};

const RARITY_VISUALS: Record<AwardRarity, AwardVisual> = {
  Core: {
    icon: "checkmark.circle.fill",
    primary: "#34D399",
    soft: "#123D33",
    deep: "#0B241F",
    label: "Tier 1 Core",
  },
  Advanced: {
    icon: "star.fill",
    primary: "#F5B84B",
    soft: "#493414",
    deep: "#281D0B",
    label: "Tier 2 Advanced",
  },
  Elite: {
    icon: "trophy.fill",
    primary: "#F472B6",
    soft: "#4A1835",
    deep: "#2A1020",
    label: "Tier 3 Elite",
  },
};

const AWARD_PAGE_ACCENT = RARITY_VISUALS.Advanced.primary;

const COLLECTION_ICONS: Record<Exclude<AwardCollectionId, "all">, IconSymbolName> = {
  quests: "checkmark.circle.fill",
  contracts: "pin.fill",
  streaks: "chart.bar.fill",
  rank: "trophy.fill",
  mastery: "star.fill",
  rare: "trophy.fill",
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

function progressWidth(pct: number): `${number}%` {
  return `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
}

function getTodayXp(todaysQuests: Quest[]): number {
  return todaysQuests
    .filter((quest) => quest.done)
    .reduce((sum, quest) => sum + quest.xp, 0);
}

function getCompletedCategoryCount(todaysQuests: Quest[]): number {
  return new Set(todaysQuests.filter((quest) => quest.done).map((quest) => quest.categoryId)).size;
}

function getContractProtectedDayCount(history: DrHistoryEntry[]): number {
  return history.filter(
    (entry) =>
      typeof entry.contractTotalCount === "number" &&
      entry.contractTotalCount > 0 &&
      entry.contractCompletedCount === entry.contractTotalCount
  ).length;
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
  const hardQuestDoneCount = doneQuests.filter((quest) => quest.difficulty === "hard").length;
  const contractQuests = todaysQuests.filter((quest) => quest.contract);
  const completedContracts = contractQuests.filter((quest) => quest.done).length;
  const streakSummary = buildStreakSummary(drHistory);
  const rankTier = getRankMeta(getRankFromDR(disciplineRating)).tier;
  const maxCategoryLevel = Math.max(...categories.map((category) => category.level), 0);

  switch (achievement.id) {
    case "first_quest":
      return clampProgress(lifetimeCompletedQuestCount, 1);
    case "quest_10":
      return clampProgress(lifetimeCompletedQuestCount, 10);
    case "30_quests":
      return clampProgress(lifetimeCompletedQuestCount, 30);
    case "quest_100":
      return clampProgress(lifetimeCompletedQuestCount, 100);
    case "hard_mode":
      return clampProgress(hardQuestDoneCount, 1);
    case "double_hard":
      return clampProgress(hardQuestDoneCount, 2);
    case "100_xp":
      return clampProgress(getTodayXp(todaysQuests), 100);
    case "xp_150":
      return clampProgress(getTodayXp(todaysQuests), 150);
    case "xp_200":
      return clampProgress(getTodayXp(todaysQuests), 200);
    case "perfect_day":
      return clampProgress(doneQuests.length, Math.max(1, todaysQuests.length));
    case "perfect_3":
      return clampProgress(drHistory.filter((entry) => entry.pct >= 100).length, 3);
    case "balanced_day":
      return clampProgress(getCompletedCategoryCount(todaysQuests), 4);
    case "level_5":
      return clampProgress(maxCategoryLevel, 5);
    case "level_10":
      return clampProgress(maxCategoryLevel, 10);
    case "all_categories":
      return clampProgress(
        categories.filter((category) => category.level >= 3).length,
        categories.length || 1
      );
    case "all_categories_5":
      return clampProgress(
        categories.filter((category) => category.level >= 5).length,
        categories.length || 1
      );
    case "first_contract":
      return clampProgress(completedContracts, Math.max(1, contractQuests.length));
    case "contract_3":
      return clampProgress(streakSummary.contractStreak, 3);
    case "contract_7":
      return clampProgress(streakSummary.contractStreak, 7);
    case "contract_14":
      return clampProgress(streakSummary.contractStreak, 14);
    case "three_solid_days":
      return clampProgress(streakSummary.solidDayStreak, 3);
    case "solid_7":
      return clampProgress(streakSummary.solidDayStreak, 7);
    case "solid_14":
      return clampProgress(streakSummary.solidDayStreak, 14);
    case "comeback_day":
      return clampProgress(drHistory.some((entry) => (entry.comebackBonus ?? 0) > 0) ? 1 : 0, 1);
    case "rank_climber":
      return clampProgress(rankTier, 2);
    case "rank_focused":
      return clampProgress(rankTier, 3);
    case "rank_driven":
      return clampProgress(rankTier, 4);
    case "rank_relentless":
      return clampProgress(rankTier, 5);
    case "rank_elite":
      return clampProgress(rankTier, 6);
    case "rank_grand":
      return clampProgress(rankTier, 7);
    default:
      return clampProgress(achievement.unlockedAt ? 1 : 0, 1);
  }
}

function getRarityWeight(rarity: AwardRarity): number {
  if (rarity === "Elite") return 3;
  if (rarity === "Advanced") return 2;
  return 1;
}

function getAwardVisual(meta: AwardMeta): AwardVisual {
  return {
    ...RARITY_VISUALS[meta.rarity],
    icon: COLLECTION_ICONS[meta.collection],
  };
}

function getAwardStatusLabel(item: EnrichedAchievement): string {
  if (item.unlocked) return "Unlocked";
  if (item.ready) return "Ready";
  return item.progress.label;
}

function AwardEmblem({
  item,
  size = "medium",
}: {
  item: EnrichedAchievement;
  size?: "small" | "medium" | "large";
}) {
  const visual = getAwardVisual(item.meta);
  const styles = size === "large"
    ? {
        outer: localAwardArtStyles.largeOuter,
        ring: localAwardArtStyles.largeRing,
        core: localAwardArtStyles.largeCore,
        iconSize: 28,
        notch: localAwardArtStyles.largeNotch,
      }
    : size === "small"
      ? {
          outer: localAwardArtStyles.smallOuter,
          ring: localAwardArtStyles.smallRing,
          core: localAwardArtStyles.smallCore,
          iconSize: 17,
          notch: localAwardArtStyles.smallNotch,
        }
      : {
          outer: localAwardArtStyles.mediumOuter,
          ring: localAwardArtStyles.mediumRing,
          core: localAwardArtStyles.mediumCore,
          iconSize: 22,
          notch: localAwardArtStyles.mediumNotch,
        };

  return (
    <View
      style={[
        styles.outer,
        {
          backgroundColor: item.unlocked || item.ready ? visual.soft : "transparent",
          borderColor: item.unlocked || item.ready ? withAlpha(visual.primary, 0.7) : "#3A3F48",
        },
      ]}
    >
      <View
        style={[
          styles.ring,
          {
            backgroundColor: item.unlocked || item.ready ? visual.deep : "#1C2129",
            borderColor: item.unlocked || item.ready ? withAlpha(visual.primary, 0.85) : "#4A505C",
          },
        ]}
      >
        <View
          style={[
            styles.core,
            {
              backgroundColor: item.unlocked || item.ready ? withAlpha(visual.primary, 0.16) : "#252B35",
            },
          ]}
        >
          <IconSymbol
            name={visual.icon}
            size={styles.iconSize}
            color={item.unlocked || item.ready ? visual.primary : "#87909F"}
          />
        </View>
      </View>
      <View
        style={[
          styles.notch,
          {
            backgroundColor: item.unlocked || item.ready ? visual.primary : "#687180",
          },
        ]}
      />
    </View>
  );
}

const localAwardArtStyles = StyleSheet.create({
  largeOuter: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  largeRing: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  largeCore: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  largeNotch: {
    position: "absolute",
    bottom: 8,
    width: 22,
    height: 4,
    borderRadius: 999,
  },
  mediumOuter: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediumRing: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  mediumCore: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mediumNotch: {
    position: "absolute",
    bottom: 5,
    width: 16,
    height: 3,
    borderRadius: 999,
  },
  smallOuter: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallRing: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCore: {
    width: 23,
    height: 23,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  smallNotch: {
    position: "absolute",
    bottom: 4,
    width: 13,
    height: 3,
    borderRadius: 999,
  },
});

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createAchievementStyles(colors), [colors]);
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [disciplineRating, setDisciplineRating] = useState(defaultDisciplineRating);
  const [lifetimeCompletedQuestCount, setLifetimeCompletedQuestCount] = useState(0);
  const [selectedCollection, setSelectedCollection] = useState<AwardCollectionId>("all");
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);
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

  const enrichedAchievements = useMemo<EnrichedAchievement[]>(
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
        const unlocked = Boolean(achievement.unlockedAt);
        const ready = !unlocked && progress.current >= progress.target;
        const pct = unlocked ? 100 : Math.round((progress.current / progress.target) * 100);
        return {
          achievement,
          progress,
          pct,
          unlocked,
          ready,
          meta: AWARD_META[achievement.id] ?? FALLBACK_AWARD_META,
        };
      }),
    [achievements, categories, disciplineRating, drHistory, lifetimeCompletedQuestCount, quests]
  );

  if (!hydrated) return null;

  const unlockedCount = enrichedAchievements.filter((item) => item.unlocked).length;
  const totalCount = enrichedAchievements.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const latestUnlocked = enrichedAchievements
    .filter((item) => item.achievement.unlockedAt)
    .sort((a, b) => {
      const aTime = a.achievement.unlockedAt ? new Date(a.achievement.unlockedAt).getTime() : 0;
      const bTime = b.achievement.unlockedAt ? new Date(b.achievement.unlockedAt).getTime() : 0;
      return bTime - aTime;
    });
  const nextUnlocks = enrichedAchievements
    .filter((item) => !item.unlocked)
    .sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      return getRarityWeight(b.meta.rarity) - getRarityWeight(a.meta.rarity);
    })
    .slice(0, 3);
  const filteredAchievements = enrichedAchievements.filter(
    (item) => selectedCollection === "all" || item.meta.collection === selectedCollection
  );
  const collectionStats = COLLECTIONS.map((collection) => {
    const items =
      collection.id === "all"
        ? enrichedAchievements
        : enrichedAchievements.filter((item) => item.meta.collection === collection.id);
    const unlocked = items.filter((item) => item.unlocked).length;
    return {
      ...collection,
      unlocked,
      total: items.length,
    };
  }).filter((collection) => collection.total > 0);
  const selectedAward =
    enrichedAchievements.find((item) => item.achievement.id === selectedAwardId) ??
    latestUnlocked[0] ??
    nextUnlocks[0] ??
    enrichedAchievements[0];
  const featuredAward = latestUnlocked[0] ?? nextUnlocks[0] ?? enrichedAchievements[0];

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <View style={styles.headerIcon}>
            <IconSymbol name="trophy.fill" size={18} color={AWARD_PAGE_ACCENT} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Awards</Text>
            <Text style={styles.subtitle}>Trophy room, collection progress, and next unlocks</Text>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Trophy Room</Text>
              <Text style={styles.heroTitle}>{unlockedCount}/{totalCount} unlocked</Text>
            </View>
            <View style={styles.heroPercentBadge}>
              <Text style={styles.heroPercent}>{progressPercent}%</Text>
              <Text style={styles.heroPercentLabel}>complete</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth(progressPercent) }]} />
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatTile}>
              <Text style={styles.heroStatValue}>{lifetimeCompletedQuestCount}</Text>
              <Text style={styles.heroStatLabel}>quest clears</Text>
            </View>
            <View style={styles.heroStatTile}>
              <Text style={styles.heroStatValue}>{buildStreakSummary(drHistory).solidDayStreak}</Text>
              <Text style={styles.heroStatLabel}>solid streak</Text>
            </View>
            <View style={styles.heroStatTile}>
              <Text style={styles.heroStatValue}>{getContractProtectedDayCount(drHistory)}</Text>
              <Text style={styles.heroStatLabel}>oath days</Text>
            </View>
          </View>
          <View style={styles.rarityLegend}>
            {(["Core", "Advanced", "Elite"] as const).map((rarity) => {
              const visual = RARITY_VISUALS[rarity];
              return (
                <View key={rarity} style={styles.rarityLegendItem}>
                  <View style={[styles.rarityLegendDot, { backgroundColor: visual.primary }]} />
                  <Text style={styles.rarityLegendText}>{visual.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {featuredAward ? (
          <View style={styles.featuredPanel}>
            <AwardEmblem item={featuredAward} size="large" />
            <View style={styles.featuredCopy}>
              <Text style={styles.eyebrow}>
                {featuredAward.unlocked ? "Latest Trophy" : "Closest Trophy"}
              </Text>
              <Text style={styles.featuredTitle}>{featuredAward.achievement.name}</Text>
              <Text style={styles.featuredText}>
                {featuredAward.unlocked
                  ? featuredAward.achievement.unlockedAt
                    ? `Unlocked ${formatDate(featuredAward.achievement.unlockedAt)}`
                    : "Earned from current progress"
                  : featuredAward.meta.hint}
              </Text>
            </View>
            <Text
              style={[
                styles.featuredRarity,
                { color: getAwardVisual(featuredAward.meta).primary },
              ]}
            >
              {getAwardVisual(featuredAward.meta).label}
            </Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.collectionRail}
        >
          {collectionStats.map((collection) => {
            const active = collection.id === selectedCollection;
            return (
              <Pressable
                key={collection.id}
                onPress={() => setSelectedCollection(collection.id)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${collection.label} awards`}
                style={[styles.collectionChip, active && styles.collectionChipActive]}
              >
                <Text style={[styles.collectionLabel, active && styles.collectionLabelActive]}>
                  {collection.label}
                </Text>
                <Text style={[styles.collectionMeta, active && styles.collectionMetaActive]}>
                  {collection.unlocked}/{collection.total}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {nextUnlocks.length > 0 ? (
          <View style={styles.nextPanel}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.eyebrow}>Next Unlocks</Text>
                <Text style={styles.sectionTitle}>Closest awards</Text>
              </View>
            </View>
            {nextUnlocks.map((item) => (
              <Pressable
                key={item.achievement.id}
                onPress={() => setSelectedAwardId(item.achievement.id)}
                accessibilityRole="button"
                accessibilityLabel={`View award ${item.achievement.name}`}
                style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}
              >
                <AwardEmblem item={item} size="small" />
                <View style={styles.nextMain}>
                  <Text style={styles.nextName}>{item.achievement.name}</Text>
                  <Text style={styles.nextMeta}>
                    {getAwardVisual(item.meta).label} - {item.meta.hint}
                  </Text>
                  <View style={styles.smallProgressTrack}>
                    <View
                      style={[
                        styles.smallProgressFill,
                        {
                          width: progressWidth(item.pct),
                          backgroundColor: getAwardVisual(item.meta).primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text
                  style={[
                    styles.nextProgress,
                    { color: getAwardVisual(item.meta).primary },
                  ]}
                >
                  {item.progress.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {selectedAward ? (
          <View
            style={[
              styles.detailPanel,
              {
                borderColor: withAlpha(getAwardVisual(selectedAward.meta).primary, 0.34),
              },
            ]}
          >
            <AwardEmblem item={selectedAward} size="large" />
            <View style={styles.detailCopy}>
              <View style={styles.detailTopLine}>
                <Text style={styles.eyebrow}>{getAwardVisual(selectedAward.meta).label} Trophy</Text>
                <Text
                  style={[
                    styles.detailStatus,
                    { color: getAwardVisual(selectedAward.meta).primary },
                  ]}
                >
                  {selectedAward.unlocked
                    ? "Unlocked"
                    : selectedAward.ready
                      ? "Ready"
                      : selectedAward.progress.label}
                </Text>
              </View>
              <Text style={styles.detailTitle}>{selectedAward.achievement.name}</Text>
              <Text style={styles.detailDescription}>{selectedAward.achievement.description}</Text>
              <Text style={styles.detailHint}>
                {selectedAward.unlocked
                  ? selectedAward.achievement.unlockedAt
                    ? `Earned ${formatDate(selectedAward.achievement.unlockedAt)}`
                    : "Earned"
                  : selectedAward.ready
                    ? "Requirement met. Complete one matching action to stamp this trophy."
                  : selectedAward.meta.hint}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.awardGrid}>
          {filteredAchievements.map((item) => {
            const visual = getAwardVisual(item.meta);
            return (
              <Pressable
                key={item.achievement.id}
                onPress={() => setSelectedAwardId(item.achievement.id)}
                accessibilityRole="button"
                accessibilityLabel={`View award ${item.achievement.name}`}
                style={({ pressed }) => [
                  styles.awardCard,
                  item.unlocked || item.ready
                    ? {
                        borderColor: withAlpha(visual.primary, item.unlocked ? 0.5 : 0.36),
                        backgroundColor: withAlpha(visual.primary, item.unlocked ? 0.1 : 0.05),
                      }
                    : styles.awardCardLocked,
                  selectedAward?.achievement.id === item.achievement.id && {
                    borderColor: withAlpha(visual.primary, 0.72),
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.awardTopRow}>
                  <AwardEmblem item={item} />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.awardTierPill,
                      {
                        borderColor: withAlpha(visual.primary, 0.34),
                        color: visual.primary,
                      },
                    ]}
                  >
                    {visual.label}
                  </Text>
                </View>
                <Text style={styles.awardName}>{item.achievement.name}</Text>
                <Text style={styles.awardDescription}>{item.achievement.description}</Text>
                <View style={styles.smallProgressTrack}>
                  <View
                    style={[
                      styles.smallProgressFill,
                      {
                        width: progressWidth(item.pct),
                        backgroundColor: visual.primary,
                      },
                    ]}
                  />
                </View>
                <View style={styles.awardFooter}>
                  <Text style={styles.awardDate}>
                    {item.achievement.unlockedAt
                      ? formatDate(item.achievement.unlockedAt)
                      : item.ready
                        ? "Ready"
                        : "In progress"}
                  </Text>
                  <Text style={[styles.awardRarity, { color: visual.primary }]}>
                    {getAwardStatusLabel(item)}
                  </Text>
                </View>
              </Pressable>
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
      borderColor: withAlpha(AWARD_PAGE_ACCENT, 0.34),
      backgroundColor: withAlpha(AWARD_PAGE_ACCENT, 0.11),
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
      borderColor: withAlpha(AWARD_PAGE_ACCENT, 0.3),
      backgroundColor: withAlpha(colors.surface2, 0.9),
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
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
      fontSize: 27,
      lineHeight: 32,
      fontWeight: "900",
      marginTop: 2,
    },
    heroPercentBadge: {
      minWidth: 82,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      borderColor: withAlpha(AWARD_PAGE_ACCENT, 0.38),
      backgroundColor: withAlpha(AWARD_PAGE_ACCENT, 0.12),
      alignItems: "center",
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 8,
    },
    heroPercent: {
      color: AWARD_PAGE_ACCENT,
      fontSize: 28,
      lineHeight: 31,
      fontWeight: "900",
    },
    heroPercentLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
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
      backgroundColor: AWARD_PAGE_ACCENT,
    },
    heroStatsRow: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    heroStatTile: {
      ...tileSurface,
      flex: 1,
      minWidth: 0,
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
    },
    heroStatValue: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    heroStatLabel: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "900",
      letterSpacing: 0.35,
      textTransform: "uppercase",
      marginTop: 2,
    },
    rarityLegend: {
      flexDirection: "row",
      gap: ui.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.18),
      paddingTop: ui.spacing.xs,
    },
    rarityLegendItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    rarityLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    rarityLegendText: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.25,
      textTransform: "uppercase",
    },
    featuredPanel: {
      ...cardSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      borderColor: withAlpha(AWARD_PAGE_ACCENT, 0.24),
      backgroundColor: withAlpha(colors.bg, 0.18),
    },
    featuredCopy: {
      flex: 1,
      minWidth: 0,
    },
    featuredTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      marginTop: 2,
    },
    featuredText: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: 3,
    },
    featuredRarity: {
      color: AWARD_PAGE_ACCENT,
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
    },
    collectionRail: {
      gap: ui.spacing.xs,
      paddingRight: ui.spacing.screen,
    },
    collectionChip: {
      minWidth: 86,
      minHeight: 44,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.52),
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: 7,
      justifyContent: "center",
      gap: 2,
    },
    collectionChipActive: {
      borderColor: withAlpha(AWARD_PAGE_ACCENT, 0.46),
      backgroundColor: withAlpha(AWARD_PAGE_ACCENT, 0.12),
    },
    collectionLabel: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
    },
    collectionLabelActive: {
      color: AWARD_PAGE_ACCENT,
    },
    collectionMeta: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    collectionMetaActive: {
      color: colors.textPrimary,
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
      color: AWARD_PAGE_ACCENT,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    detailPanel: {
      ...cardSurface,
      flexDirection: "row",
      gap: ui.spacing.sm,
      borderColor: withAlpha(AWARD_PAGE_ACCENT, 0.2),
      backgroundColor: withAlpha(colors.surface2, 0.7),
    },
    detailCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    detailTopLine: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
    },
    detailStatus: {
      color: AWARD_PAGE_ACCENT,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.35,
      textTransform: "uppercase",
      textAlign: "right",
    },
    detailTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    detailDescription: {
      color: withAlpha(colors.textSecondary, 0.88),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    detailHint: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.3,
      textTransform: "uppercase",
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
      minHeight: 172,
      gap: 7,
    },
    awardCardLocked: {
      opacity: 0.82,
    },
    awardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
    },
    awardTierPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 4,
      flexShrink: 1,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      textAlign: "right",
      overflow: "hidden",
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
      backgroundColor: AWARD_PAGE_ACCENT,
    },
    awardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: ui.spacing.xs,
    },
    awardDate: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "800",
      letterSpacing: 0.25,
      textTransform: "uppercase",
      flex: 1,
    },
    awardRarity: {
      color: AWARD_PAGE_ACCENT,
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "900",
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    pressed: {
      opacity: 0.74,
    },
  });
}
