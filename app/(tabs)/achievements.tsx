import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "./_components/ScreenHeader";
import { CONTRACT_GOLD } from "./_styles";
import { mergeAchievements } from "./_utils/achievements";
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

type AwardCollection =
  | "quests"
  | "contracts"
  | "streaks"
  | "rank"
  | "mastery"
  | "rare";

type AwardTrackId = "all" | "quest" | "consistency" | "legacy";

type AwardRarity = "Core" | "Advanced" | "Elite";

type AwardMeta = {
  collection: AwardCollection;
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

type AwardTrack = (typeof AWARD_TRACKS)[number];

type EnrichedAchievement = {
  achievement: Achievement;
  progress: AchievementProgress;
  pct: number;
  unlocked: boolean;
  ready: boolean;
  meta: AwardMeta;
};

const AWARD_TRACKS: {
  id: AwardTrackId;
  label: string;
  body: string;
  collections: AwardCollection[];
  icon: IconSymbolName;
  primary: string;
}[] = [
  {
    id: "all",
    label: "All",
    body: "Every earned and locked badge.",
    collections: ["quests", "contracts", "streaks", "rank", "mastery", "rare"],
    icon: "trophy.fill",
    primary: "#F5B84B",
  },
  {
    id: "quest",
    label: "Quest",
    body: "Quest clears, XP pushes, hard reps, and perfect days.",
    collections: ["quests"],
    icon: "flag.fill",
    primary: "#34D399",
  },
  {
    id: "consistency",
    label: "Consistency",
    body: "Contract protection and streaks that prove the routine holds.",
    collections: ["contracts", "streaks"],
    icon: "shield.fill",
    primary: CONTRACT_GOLD,
  },
  {
    id: "legacy",
    label: "Legacy",
    body: "Rank climbs, category mastery, rare feats, and long-run badges.",
    collections: ["rank", "mastery", "rare"],
    icon: "trophy.fill",
    primary: "#F472B6",
  },
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
  quest_50: {
    collection: "quests",
    rarity: "Advanced",
    hint: "Keep building lifetime quest clears.",
  },
  quest_100: {
    collection: "quests",
    rarity: "Elite",
    hint: "This is a long-run consistency badge.",
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
  contract_21: {
    collection: "contracts",
    rarity: "Elite",
    hint: "Protect contracts for twenty-one judgment days.",
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
  solid_21: {
    collection: "streaks",
    rarity: "Elite",
    hint: "Reach 60%+ for twenty-one judgments in a row.",
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
  hint: "Keep completing quests to reveal this badge.",
};

const AWARD_PAGE_ACCENT = "#F5B84B";
const EQUIPPED_BADGE_SLOT_COUNT = 3;
const PLAYER_CARD_TRACK_IDS: AwardTrackId[] = ["quest", "consistency", "legacy"];

function getAwardTrack(meta: AwardMeta) {
  return AWARD_TRACKS.find(
    (track) => track.id !== "all" && track.collections.includes(meta.collection)
  ) ?? AWARD_TRACKS[1];
}

function getAwardTrackVisual(track: AwardTrack): AwardVisual {
  if (track.id === "quest") {
    return {
      icon: track.icon,
      primary: track.primary,
      soft: "#123D33",
      deep: "#0B241F",
      label: "Quest Badge",
    };
  }

  if (track.id === "legacy") {
    return {
      icon: track.icon,
      primary: track.primary,
      soft: "#4A1835",
      deep: "#2A1020",
      label: "Legacy Badge",
    };
  }

  return {
    icon: track.icon,
    primary: track.primary,
    soft: "#3A2A12",
    deep: "#20170B",
    label: "Consistency Badge",
  };
}

function createEquippedBadgeSlots(ids: (string | null)[]): (string | null)[] {
  return Array.from({ length: EQUIPPED_BADGE_SLOT_COUNT }, (_, index) => ids[index] ?? null);
}

function getEquippedBadgeSlotIndex(meta: AwardMeta): number {
  return PLAYER_CARD_TRACK_IDS.indexOf(getAwardTrack(meta).id);
}

function normalizeEquippedBadgeIds(value: unknown, achievements: Achievement[]): (string | null)[] {
  if (!Array.isArray(value)) return createEquippedBadgeSlots([]);

  const unlockedIds = new Set(
    achievements.filter((achievement) => achievement.unlockedAt).map((achievement) => achievement.id)
  );
  const usedIds = new Set<string>();
  const slots = createEquippedBadgeSlots([]);

  value.slice(0, EQUIPPED_BADGE_SLOT_COUNT).forEach((candidate) => {
    if (typeof candidate !== "string") return;
    if (!unlockedIds.has(candidate)) return;
    if (usedIds.has(candidate)) return;

    const meta = AWARD_META[candidate] ?? FALLBACK_AWARD_META;
    const slotIndex = getEquippedBadgeSlotIndex(meta);
    if (slotIndex < 0 || slots[slotIndex]) return;

    usedIds.add(candidate);
    slots[slotIndex] = candidate;
  });

  return slots;
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
    case "quest_50":
      return clampProgress(lifetimeCompletedQuestCount, 50);
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
    case "contract_21":
      return clampProgress(streakSummary.contractStreak, 21);
    case "three_solid_days":
      return clampProgress(streakSummary.solidDayStreak, 3);
    case "solid_7":
      return clampProgress(streakSummary.solidDayStreak, 7);
    case "solid_14":
      return clampProgress(streakSummary.solidDayStreak, 14);
    case "solid_21":
      return clampProgress(streakSummary.solidDayStreak, 21);
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
  return getAwardTrackVisual(getAwardTrack(meta));
}

function getAwardStatusLabel(item: EnrichedAchievement): string {
  if (item.unlocked) return "Equip";
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
  const [selectedCollection, setSelectedCollection] = useState<AwardTrackId>("all");
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);
  const [equippedBadgeIds, setEquippedBadgeIds] = useState<(string | null)[]>(createEquippedBadgeSlots([]));
  const [hydrated, setHydrated] = useState(false);

  const persistEquippedBadgeIds = useCallback(async (nextEquippedBadgeIds: (string | null)[]) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...parsed,
          equippedBadgeIds: nextEquippedBadgeIds,
        })
      );
    } catch (error) {
      if (__DEV__) console.warn("Failed to equip badge:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const loadedAchievements = mergeAchievements(parsed.achievements);
      setAchievements(loadedAchievements);
      setEquippedBadgeIds(normalizeEquippedBadgeIds(parsed.equippedBadgeIds, loadedAchievements));
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
      if (__DEV__) console.warn("Failed to load achievements:", error);
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
    (item) => selectedCollection === "all" || getAwardTrack(item.meta).id === selectedCollection
  );
  const collectionStats = AWARD_TRACKS.map((collection) => {
    const items =
      collection.id === "all"
        ? enrichedAchievements
        : enrichedAchievements.filter((item) => getAwardTrack(item.meta).id === collection.id);
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
  const selectedAwardEquipped = selectedAward
    ? equippedBadgeIds.includes(selectedAward.achievement.id)
    : false;
  const featuredAwardEquipped = featuredAward
    ? equippedBadgeIds.includes(featuredAward.achievement.id)
    : false;

  const equipAward = (item: EnrichedAchievement) => {
    if (!item.unlocked) {
      setSelectedAwardId(item.achievement.id);
      return;
    }

    const slotIndex = getEquippedBadgeSlotIndex(item.meta);
    if (slotIndex < 0) return;

    const nextEquippedBadgeIds = createEquippedBadgeSlots(equippedBadgeIds);
    nextEquippedBadgeIds[slotIndex] = item.achievement.id;

    setSelectedAwardId(item.achievement.id);
    setEquippedBadgeIds(nextEquippedBadgeIds);
    void persistEquippedBadgeIds(nextEquippedBadgeIds);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Awards"
          subtitle="Quest, Consistency, and Legacy badge collection"
          icon="trophy.fill"
          accent={AWARD_PAGE_ACCENT}
        />

        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Badge Vault</Text>
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
              <Text style={styles.heroStatLabel}>protected days</Text>
            </View>
          </View>
          <View style={styles.rarityLegend}>
            {AWARD_TRACKS.filter((track) => track.id !== "all").map((track) => {
              return (
                <View key={track.id} style={styles.rarityLegendItem}>
                  <IconSymbol name={track.icon} size={13} color={track.primary} />
                  <Text style={styles.rarityLegendText}>{track.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {featuredAward ? (
          <Pressable
            onPress={() => equipAward(featuredAward)}
            accessibilityRole="button"
            accessibilityLabel={
              featuredAward.unlocked
                ? `Equip badge ${featuredAward.achievement.name}`
                : `View award ${featuredAward.achievement.name}`
            }
            style={({ pressed }) => [styles.featuredPanel, pressed && styles.pressed]}
          >
            <AwardEmblem item={featuredAward} size="large" />
            <View style={styles.featuredCopy}>
              <Text style={styles.eyebrow}>
                {featuredAward.unlocked ? "Latest Badge" : "Closest Badge"}
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
              {featuredAwardEquipped
                ? "Equipped"
                : featuredAward.unlocked
                  ? "Equip"
                  : getAwardVisual(featuredAward.meta).label}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.collectionGrid}>
          {collectionStats.map((collection) => {
            const active = collection.id === selectedCollection;
            const activeTone = collection.primary;
            return (
              <Pressable
                key={collection.id}
                onPress={() => setSelectedCollection(collection.id)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${collection.label} awards`}
                style={[
                  styles.collectionChip,
                  active && {
                    borderColor: withAlpha(activeTone, 0.48),
                    backgroundColor: withAlpha(activeTone, 0.12),
                  },
                ]}
              >
                <View style={styles.collectionTopLine}>
                  <IconSymbol
                    name={collection.icon}
                    size={14}
                    color={active ? activeTone : colors.textSecondary}
                  />
                  <Text style={[styles.collectionLabel, active && { color: activeTone }]}>
                    {collection.label}
                  </Text>
                </View>
                <Text style={[styles.collectionMeta, active && styles.collectionMetaActive]}>
                  {collection.unlocked}/{collection.total}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
                    {getAwardTrack(item.meta).label} - {item.meta.hint}
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
                <Text style={styles.eyebrow}>{getAwardTrack(selectedAward.meta).label} Badge</Text>
                <Text
                  style={[
                    styles.detailStatus,
                    { color: getAwardVisual(selectedAward.meta).primary },
                  ]}
                >
                  {selectedAwardEquipped
                    ? "Equipped"
                    : selectedAward.unlocked
                      ? "Equip"
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
                    ? "Requirement met. Complete one matching action to stamp this badge."
                  : selectedAward.meta.hint}
              </Text>
              {selectedAward.unlocked ? (
                <Pressable
                  onPress={() => equipAward(selectedAward)}
                  disabled={selectedAwardEquipped}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedAwardEquipped
                      ? `${selectedAward.achievement.name} is equipped to your player card`
                      : `Equip ${selectedAward.achievement.name} to your player card`
                  }
                  style={({ pressed }) => [
                    styles.detailActionButton,
                    {
                      borderColor: withAlpha(getAwardVisual(selectedAward.meta).primary, 0.46),
                      backgroundColor: selectedAwardEquipped
                        ? withAlpha(getAwardVisual(selectedAward.meta).primary, 0.16)
                        : withAlpha(getAwardVisual(selectedAward.meta).primary, 0.1),
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.detailActionButtonText,
                      { color: getAwardVisual(selectedAward.meta).primary },
                    ]}
                  >
                    {selectedAwardEquipped ? "Equipped To Card" : "Equip To Card"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.awardGrid}>
          {filteredAchievements.map((item) => {
            const visual = getAwardVisual(item.meta);
            const track = getAwardTrack(item.meta);
            const isEquipped = equippedBadgeIds.includes(item.achievement.id);
            return (
              <Pressable
                key={item.achievement.id}
                onPress={() => equipAward(item)}
                accessibilityRole="button"
                accessibilityLabel={
                  item.unlocked
                    ? `Equip badge ${item.achievement.name}`
                    : `View award ${item.achievement.name}`
                }
                style={({ pressed }) => [
                  styles.awardCard,
                  item.unlocked || item.ready
                    ? {
                        borderColor: withAlpha(visual.primary, item.unlocked ? 0.5 : 0.36),
                        backgroundColor: withAlpha(visual.primary, item.unlocked ? 0.1 : 0.05),
                      }
                    : styles.awardCardLocked,
                  isEquipped && {
                    borderColor: withAlpha(visual.primary, 0.78),
                    backgroundColor: withAlpha(visual.primary, 0.16),
                  },
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
                    {track.label}
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
                    {isEquipped
                      ? "Equipped"
                      : item.achievement.unlockedAt
                      ? formatDate(item.achievement.unlockedAt)
                      : item.ready
                        ? "Ready"
                        : "In progress"}
                  </Text>
                  <Text style={[styles.awardRarity, { color: visual.primary }]}>
                    {isEquipped ? "On card" : getAwardStatusLabel(item)}
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
      paddingBottom: ui.spacing.lg,
      gap: ui.spacing.sm,
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
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    collectionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: ui.spacing.xs,
    },
    collectionChip: {
      width: "48.7%",
      minHeight: 50,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.52),
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
      justifyContent: "center",
      gap: 4,
    },
    collectionTopLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    collectionLabel: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
    },
    collectionMeta: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 15,
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
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    detailActionButton: {
      alignSelf: "flex-start",
      minHeight: 34,
      borderRadius: ui.radius.button,
      borderWidth: 1,
      paddingHorizontal: ui.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    detailActionButtonText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
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
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
      flex: 1,
    },
    awardRarity: {
      color: AWARD_PAGE_ACCENT,
      fontSize: 8,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    pressed: {
      opacity: 0.74,
    },
  });
}
