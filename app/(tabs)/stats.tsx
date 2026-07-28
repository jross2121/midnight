import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CONTRACT_GOLD } from "@/src/styles";
import { RankBadge } from "@/src/components/RankBadge";
import { FixedPercent } from "@/src/components/FixedPercent";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ScreenLoading } from "@/src/components/ScreenLoading";
import { mergeAchievements } from "@/src/utils/achievements";
import { defaultAchievements } from "@/src/utils/defaultData";
import { createCardSurface, createTileSurface, ui, withAlpha } from "@/src/utils/designSystem";
import { DR_RANK_THRESHOLDS, getNextRank, getRankFromDR, getRankMeta } from "@/src/utils/rank";
import { useTheme, type Theme, type ThemeColors } from "@/src/utils/themeContext";
import type { Achievement, StoredState } from "@/src/utils/types";
import { STORAGE_KEY } from "@/src/utils/types";

type IconSymbolName = React.ComponentProps<typeof IconSymbol>["name"];
type BadgeCollection = "quests" | "contracts" | "streaks" | "rank" | "mastery" | "rare";
type BadgeRarity = "Core" | "Advanced" | "Elite";
type BadgeTrackId = "quest" | "consistency" | "legacy";

type BadgeMeta = {
  collection: BadgeCollection;
  rarity: BadgeRarity;
};

type BadgeTrack = {
  id: BadgeTrackId;
  label: string;
  title: string;
  subtitle: string;
  emptyLabel: string;
  icon: IconSymbolName;
  collections: BadgeCollection[];
};

type TrackVisual = {
  primary: string;
  surface: string;
  border: string;
  text: string;
};

const RANK_TONE = "#F5B84B";
const BADGE_SLOT_COUNT = 3;

const BADGE_TRACKS: BadgeTrack[] = [
  {
    id: "quest",
    label: "Quest",
    title: "Quest",
    subtitle: "Quest award slot",
    emptyLabel: "Quest slot open",
    icon: "flag.fill",
    collections: ["quests"],
  },
  {
    id: "consistency",
    label: "Consistency",
    title: "Consistency",
    subtitle: "Consistency award slot",
    emptyLabel: "Consistency slot open",
    icon: "shield.fill",
    collections: ["contracts", "streaks"],
  },
  {
    id: "legacy",
    label: "Legacy",
    title: "Legacy",
    subtitle: "Legacy award slot",
    emptyLabel: "Legacy slot open",
    icon: "trophy.fill",
    collections: ["rank", "mastery", "rare"],
  },
];

const BADGE_META: Record<string, BadgeMeta> = {
  first_quest: { collection: "quests", rarity: "Core" },
  quest_10: { collection: "quests", rarity: "Core" },
  "30_quests": { collection: "quests", rarity: "Advanced" },
  quest_50: { collection: "quests", rarity: "Advanced" },
  quest_100: { collection: "quests", rarity: "Elite" },
  hard_mode: { collection: "quests", rarity: "Core" },
  double_hard: { collection: "quests", rarity: "Advanced" },
  "100_xp": { collection: "quests", rarity: "Core" },
  xp_150: { collection: "quests", rarity: "Advanced" },
  xp_200: { collection: "rare", rarity: "Elite" },
  perfect_day: { collection: "quests", rarity: "Advanced" },
  perfect_3: { collection: "rare", rarity: "Elite" },
  balanced_day: { collection: "mastery", rarity: "Advanced" },
  level_5: { collection: "mastery", rarity: "Core" },
  level_10: { collection: "mastery", rarity: "Elite" },
  all_categories: { collection: "mastery", rarity: "Advanced" },
  all_categories_5: { collection: "mastery", rarity: "Elite" },
  first_contract: { collection: "contracts", rarity: "Core" },
  contract_3: { collection: "contracts", rarity: "Advanced" },
  contract_7: { collection: "contracts", rarity: "Elite" },
  contract_14: { collection: "contracts", rarity: "Elite" },
  contract_21: { collection: "contracts", rarity: "Elite" },
  three_solid_days: { collection: "streaks", rarity: "Core" },
  solid_7: { collection: "streaks", rarity: "Advanced" },
  solid_14: { collection: "streaks", rarity: "Elite" },
  solid_21: { collection: "streaks", rarity: "Elite" },
  comeback_day: { collection: "rare", rarity: "Advanced" },
  rank_climber: { collection: "rank", rarity: "Core" },
  rank_focused: { collection: "rank", rarity: "Advanced" },
  rank_driven: { collection: "rank", rarity: "Advanced" },
  rank_relentless: { collection: "rank", rarity: "Elite" },
  rank_elite: { collection: "rank", rarity: "Elite" },
  rank_grand: { collection: "rare", rarity: "Elite" },
};

const FALLBACK_BADGE_META: BadgeMeta = {
  collection: "quests",
  rarity: "Core",
};

const COLLECTION_LABELS: Record<BadgeCollection, string> = {
  quests: "Quest",
  contracts: "Contract",
  streaks: "Streak",
  rank: "Rank",
  mastery: "Mastery",
  rare: "Rare",
};

const RARITY_WEIGHT: Record<BadgeRarity, number> = {
  Core: 1,
  Advanced: 2,
  Elite: 3,
};

function getRankTone(tier: number): string {
  return tier >= 7 ? "#FFE19A" : RANK_TONE;
}

function getBadgeMeta(id: string): BadgeMeta {
  return BADGE_META[id] ?? FALLBACK_BADGE_META;
}

function getTrackForCollection(collection: BadgeCollection): BadgeTrack {
  return BADGE_TRACKS.find((track) => track.collections.includes(collection)) ?? BADGE_TRACKS[0];
}

function getTrackForAchievement(achievement: Achievement): BadgeTrack {
  return getTrackForCollection(getBadgeMeta(achievement.id).collection);
}

function getTrackVisual(trackId: BadgeTrackId, isLightTheme: boolean): TrackVisual {
  if (trackId === "quest") {
    return {
      primary: "#34D399",
      surface: isLightTheme ? "#ECFDF5" : "#0B241F",
      border: isLightTheme ? "#86EFAC" : "#1F5C4A",
      text: isLightTheme ? "#047857" : "#A7F3D0",
    };
  }

  if (trackId === "legacy") {
    return {
      primary: "#F472B6",
      surface: isLightTheme ? "#FDF2F8" : "#2A1020",
      border: isLightTheme ? "#F9A8D4" : "#6D254D",
      text: isLightTheme ? "#BE185D" : "#FBCFE8",
    };
  }

  return {
    primary: CONTRACT_GOLD,
    surface: isLightTheme ? "#FFF7E6" : "#241B0C",
    border: isLightTheme ? "#F0C96E" : "#6E5625",
    text: isLightTheme ? "#7C4A03" : "#F5D783",
  };
}

function getSortedUnlockedAchievements(achievements: Achievement[]): Achievement[] {
  return achievements
    .filter((achievement) => achievement.unlockedAt)
    .sort((a, b) => {
      const aTrackIndex = BADGE_TRACKS.findIndex((track) => track.id === getTrackForAchievement(a).id);
      const bTrackIndex = BADGE_TRACKS.findIndex((track) => track.id === getTrackForAchievement(b).id);
      if (aTrackIndex !== bTrackIndex) return aTrackIndex - bTrackIndex;

      const aMeta = getBadgeMeta(a.id);
      const bMeta = getBadgeMeta(b.id);
      const rarityDiff = RARITY_WEIGHT[bMeta.rarity] - RARITY_WEIGHT[aMeta.rarity];
      if (rarityDiff !== 0) return rarityDiff;

      return Date.parse(b.unlockedAt ?? "") - Date.parse(a.unlockedAt ?? "");
    });
}

function createBadgeSlots(ids: (string | null)[]): (string | null)[] {
  return Array.from({ length: BADGE_SLOT_COUNT }, (_, index) => ids[index] ?? null);
}

function getDefaultEquippedBadgeIds(unlockedAchievements: Achievement[]): (string | null)[] {
  return BADGE_TRACKS.map((track) => {
    const achievement = unlockedAchievements.find((item) => getTrackForAchievement(item).id === track.id);
    return achievement?.id ?? null;
  });
}

function normalizeEquippedBadgeIds(value: unknown, unlockedAchievements: Achievement[]): (string | null)[] {
  if (!Array.isArray(value)) return createBadgeSlots([]);

  const unlockedIds = new Set(unlockedAchievements.map((achievement) => achievement.id));
  const usedIds = new Set<string>();
  const slots = createBadgeSlots([]);

  value.slice(0, BADGE_SLOT_COUNT).forEach((candidate) => {
    if (typeof candidate !== "string") return;
    if (!unlockedIds.has(candidate)) return;
    if (usedIds.has(candidate)) return;

    const meta = getBadgeMeta(candidate);
    const track = getTrackForCollection(meta.collection);
    const slotIndex = BADGE_TRACKS.findIndex((item) => item.id === track.id);
    if (slots[slotIndex]) return;

    usedIds.add(candidate);
    slots[slotIndex] = candidate;
  });

  return slots;
}

export default function StatsScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createDisciplineStyles(colors, theme), [colors, theme]);
  const [disciplineRating, setDisciplineRating] = useState<number>(0);
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [equippedBadgeIds, setEquippedBadgeIds] = useState<(string | null)[]>(createBadgeSlots([]));
  const [hydrated, setHydrated] = useState(false);
  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/more");
  };

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const loadedDR = typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : 0;
      const loadedAchievements = mergeAchievements(parsed.achievements);
      const unlockedAchievements = getSortedUnlockedAchievements(loadedAchievements);
      const savedEquippedBadgeIds = normalizeEquippedBadgeIds(parsed.equippedBadgeIds, unlockedAchievements);
      const fallbackEquippedBadgeIds = getDefaultEquippedBadgeIds(unlockedAchievements);
      const rawSavedSlots = Array.isArray(parsed.equippedBadgeIds)
        ? parsed.equippedBadgeIds.slice(0, BADGE_SLOT_COUNT)
        : null;
      const hasExplicitEmptySlot = rawSavedSlots?.some((item) => item === null) ?? false;
      const loadedEquippedBadgeIds = rawSavedSlots
        ? savedEquippedBadgeIds.map((id, index) =>
            id ?? (hasExplicitEmptySlot ? null : fallbackEquippedBadgeIds[index])
          )
        : fallbackEquippedBadgeIds;

      setDisciplineRating(loadedDR);
      setAchievements(loadedAchievements);
      setEquippedBadgeIds(loadedEquippedBadgeIds);
      setHydrated(true);
    } catch (e) {
      if (__DEV__) console.warn("Failed to load storage:", e);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!hydrated) {
    return <ScreenLoading label="Loading player card" />;
  }

  const isLightTheme = theme === "light";
  const rankName = getRankFromDR(disciplineRating);
  const rankMeta = getRankMeta(rankName);
  const rankTone = getRankTone(rankMeta.tier);
  const rankGoldBorder = isLightTheme ? "#F0C96E" : "#5B421B";
  const rankGoldSoftSurface = isLightTheme ? "#FFF7E6" : "#1C1710";
  const rankTileSurface = isLightTheme ? "#F8FAFC" : "#0B1117";
  const rankSoftBorder = isLightTheme ? "#E2E8F0" : "#1B2634";
  const nextRank = getNextRank(disciplineRating);
  const nextRankMeta = nextRank ? getRankMeta(nextRank.name) : null;
  const tierSpan = nextRankMeta ? Math.max(1, nextRankMeta.minDr - rankMeta.minDr) : 1;
  const rankProgress = nextRankMeta
    ? Math.max(0, Math.min(1, (disciplineRating - rankMeta.minDr) / tierSpan))
    : 1;
  const rankProgressPercent = Math.round(rankProgress * 100);
  const unlockedAchievements = getSortedUnlockedAchievements(achievements);
  const equippedSlots = BADGE_TRACKS.map((track, index) => {
    const badgeId = equippedBadgeIds[index];
    const achievement = badgeId
      ? unlockedAchievements.find((item) => item.id === badgeId && getTrackForAchievement(item).id === track.id) ?? null
      : null;
    return { track, achievement };
  });
  const earnedBadgeCount = unlockedAchievements.length;
  const equippedBadgeCount = equippedSlots.filter(({ achievement }) => achievement).length;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Player Card"
          subtitle="Your rank identity and equipped awards"
          icon="chevron.left"
          accent={rankTone}
          onIconPress={navigateBack}
          iconAccessibilityLabel="Go back"
        />

        <View style={[styles.playerCard, { borderColor: rankGoldBorder }]}>
          <View style={styles.profileHeroRow}>
            <View style={[styles.rankCrestOuter, { borderColor: rankGoldBorder }]}>
              <View style={styles.rankCrestInner}>
                <RankBadge rankTier={rankMeta.tier} size={56} color={rankTone} active />
              </View>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.eyebrow}>Current rank</Text>
              <Text style={styles.rankName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>
                {rankName}
              </Text>
              <Text style={styles.rankMeta} numberOfLines={1}>
                Tier {rankMeta.tier} / {DR_RANK_THRESHOLDS.length}
              </Text>
            </View>
          </View>

          <View style={styles.identityStrip}>
            <View style={styles.identityTile}>
              <Text style={styles.identityLabel}>DR</Text>
              <Text style={[styles.identityValue, { color: rankTone }]}>{disciplineRating}</Text>
            </View>
            <View style={styles.identityTile}>
              <Text style={styles.identityLabel}>Awards</Text>
              <Text style={styles.identityValue} numberOfLines={1}>
                {earnedBadgeCount} earned
              </Text>
            </View>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Tier progress</Text>
              <FixedPercent
                value={rankProgressPercent}
                textStyle={[styles.progressValue, { color: rankTone }]}
                accessibilityLabel={`${rankProgressPercent}% tier progress`}
              />
            </View>
            <View style={styles.rankProgressTrack}>
              <View style={[styles.rankProgressFill, { width: `${rankProgressPercent}%`, backgroundColor: rankTone }]} />
            </View>
          </View>

          <View style={styles.loadoutPanel}>
            <View style={styles.loadoutHeader}>
              <View>
                <Text style={styles.eyebrow}>Award showcase</Text>
                <Text style={styles.sectionTitle}>Equipped awards</Text>
              </View>
              <Text style={styles.miniMeta}>{equippedBadgeCount}/3 equipped</Text>
            </View>

            <View style={styles.slotStack}>
              {equippedSlots.map(({ track, achievement }) => {
                const meta = achievement ? getBadgeMeta(achievement.id) : null;
                const trackVisual = getTrackVisual(track.id, isLightTheme);
                const collectionLabel = meta ? COLLECTION_LABELS[meta.collection] : track.label;

                return (
                  <Pressable
                    key={track.id}
                    onPress={() => router.push("/(tabs)/achievements")}
                    accessibilityRole="button"
                    accessibilityLabel={
                      achievement
                        ? `Open Awards to change ${achievement.name}`
                        : `Open Awards to equip a ${track.title.toLowerCase()} award`
                    }
                    style={({ pressed }) => [
                      styles.trackSlot,
                      achievement
                        ? {
                            borderColor: trackVisual.border,
                            backgroundColor: trackVisual.surface,
                          }
                        : null,
                      pressed && styles.trackSlotPressed,
                    ]}
                  >
                    <View style={[styles.trackSlotRail, { backgroundColor: trackVisual.primary }]} />
                    <View
                      style={[
                        styles.trackIconPlate,
                        {
                          borderColor: trackVisual.border,
                          backgroundColor: trackVisual.surface,
                        },
                      ]}
                    >
                      <IconSymbol
                        name={track.icon}
                        size={18}
                        color={trackVisual.primary}
                      />
                    </View>
                    <View style={styles.trackSlotCopy}>
                      <Text style={[styles.trackSlotLabel, { color: trackVisual.text }]}>{track.title}</Text>
                      <Text style={styles.trackSlotName} numberOfLines={1}>
                        {achievement?.name ?? track.emptyLabel}
                      </Text>
                      <Text style={styles.trackSlotMeta} numberOfLines={1}>
                        {achievement && meta ? `${meta.rarity} ${collectionLabel}` : "Equip from Awards"}
                      </Text>
                    </View>
                    <Text
                      style={[styles.trackSlotState, achievement && { color: trackVisual.text }]}
                      numberOfLines={1}
                    >
                      {achievement ? "Equipped" : "Empty"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.rankPathPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Rank path</Text>
              <Text style={styles.sectionTitle}>
                {nextRank ? `${nextRank.remainingDr} DR to ${nextRank.name}` : "Top rank secured"}
              </Text>
            </View>
            <Text style={styles.miniMeta}>All {DR_RANK_THRESHOLDS.length}</Text>
          </View>
          <View style={styles.rankPathList}>
            {DR_RANK_THRESHOLDS.map((rank) => {
              const isCurrent = rank.name === rankName;
              const isNext = nextRank?.name === rank.name;
              const isUnlocked = disciplineRating >= rank.minDr;
              const rowTone = getRankTone(rank.tier);
              const maxLabel = Number.isFinite(rank.maxDr) ? `${rank.maxDr} DR` : "No cap";

              return (
                <View
                  key={rank.name}
                  style={[
                    styles.rankPathRow,
                    isCurrent && {
                      borderColor: rankGoldBorder,
                      backgroundColor: rankGoldSoftSurface,
                    },
                    isNext && styles.rankPathRowNext,
                    isNext && {
                      borderColor: rankGoldBorder,
                      backgroundColor: rankTileSurface,
                    },
                    isUnlocked && !isCurrent && {
                      borderColor: rankSoftBorder,
                      backgroundColor: rankTileSurface,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rankPathStateRail,
                      {
                        backgroundColor: isCurrent
                          ? rowTone
                          : isNext
                            ? "transparent"
                            : isUnlocked
                              ? rowTone
                              : rankSoftBorder,
                        borderColor: isNext ? rankGoldBorder : "transparent",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.rankPathMark,
                      {
                        borderColor: isCurrent || isNext ? rankGoldBorder : rankSoftBorder,
                        backgroundColor: isCurrent || isNext ? rankGoldSoftSurface : rankTileSurface,
                      },
                    ]}
                  >
                    <RankBadge
                      rank={rank.name}
                      size={24}
                      active={isUnlocked || isNext}
                      color={isUnlocked || isNext ? rowTone : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.rankPathCopy}>
                    <Text style={styles.rankPathName}>{rank.name}</Text>
                    <Text style={styles.rankPathRange}>
                      {rank.minDr} DR - {maxLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rankPathStatusPill,
                      isCurrent && {
                        borderColor: rankGoldBorder,
                        backgroundColor: rankGoldSoftSurface,
                      },
                      isNext && {
                        borderColor: rankGoldBorder,
                        backgroundColor: rankTileSurface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankPathStatus,
                        (isCurrent || isNext || isUnlocked) && { color: rowTone },
                      ]}
                    >
                      {isCurrent ? "Current" : isNext ? "Target" : isUnlocked ? "Cleared" : "Locked"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createDisciplineStyles(colors: ThemeColors, theme: Theme) {
  const isLightTheme = theme === "light";
  const cardBackground = isLightTheme ? colors.surface : colors.surface2;
  const heroBackground = isLightTheme ? colors.surface : "#111923";
  const tileBackground = isLightTheme ? "#F8FAFC" : "#0B1117";
  const softBorder = isLightTheme ? "#E2E8F0" : "#1B2634";
  const divider = isLightTheme ? "#E2E8F0" : "#1A2633";
  const progressTrack = isLightTheme ? "#E5E7EB" : "#0B1117";
  const cardSurface = createCardSurface(colors, {
    padding: ui.spacing.card,
    radius: ui.radius.card,
    borderOpacity: 0.24,
    glowOpacity: 0.025,
    backgroundColor: cardBackground,
  });
  const heroSurface = createCardSurface(colors, {
    padding: ui.spacing.card,
    radius: ui.radius.card,
    borderOpacity: 0.28,
    glowOpacity: 0.035,
    backgroundColor: heroBackground,
  });
  const tileSurface = createTileSurface(colors, {
    padding: ui.spacing.sm,
    radius: ui.radius.md,
    borderOpacity: 0.22,
    backgroundColor: tileBackground,
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
    playerCard: {
      ...heroSurface,
      gap: ui.spacing.sm,
      paddingHorizontal: ui.spacing.md,
      paddingVertical: ui.spacing.md,
    },
    profileHeroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.md,
    },
    rankCrestOuter: {
      width: 86,
      height: 86,
      borderRadius: 28,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tileBackground,
    },
    rankCrestInner: {
      width: 70,
      height: 70,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isLightTheme ? "#FFFFFF" : "#0B1117",
    },
    profileCopy: {
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
    rankName: {
      color: colors.textPrimary,
      fontSize: 29,
      lineHeight: 33,
      fontWeight: "900",
      marginTop: 3,
    },
    rankMeta: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 2,
      textTransform: "uppercase",
    },
    identityStrip: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    identityTile: {
      ...tileSurface,
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      justifyContent: "center",
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
    },
    identityLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    identityValue: {
      color: colors.textPrimary,
      fontSize: 17,
      lineHeight: 21,
      fontWeight: "900",
      marginTop: 2,
    },
    progressBlock: {
      gap: ui.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: divider,
      paddingTop: ui.spacing.sm,
    },
    progressHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    progressLabel: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    progressValue: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      textAlign: "right",
      flexShrink: 1,
    },
    rankProgressTrack: {
      height: 12,
      borderRadius: 999,
      backgroundColor: progressTrack,
      borderWidth: 1,
      borderColor: softBorder,
      overflow: "hidden",
    },
    rankProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: RANK_TONE,
    },
    loadoutPanel: {
      gap: ui.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: divider,
      paddingTop: ui.spacing.sm,
    },
    loadoutHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "900",
      marginTop: 1,
    },
    miniMeta: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      textAlign: "right",
    },
    slotStack: {
      gap: ui.spacing.xs,
    },
    trackSlot: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
      minHeight: 72,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      borderColor: softBorder,
      backgroundColor: tileBackground,
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
      overflow: "hidden",
    },
    trackSlotPressed: {
      opacity: 0.76,
    },
    trackSlotRail: {
      width: 4,
      alignSelf: "stretch",
      borderRadius: 999,
    },
    trackIconPlate: {
      width: 38,
      height: 38,
      borderRadius: ui.radius.sm,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    trackSlotCopy: {
      flex: 1,
      minWidth: 0,
    },
    trackSlotLabel: {
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    trackSlotName: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      marginTop: 1,
    },
    trackSlotMeta: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 1,
    },
    trackSlotState: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      textAlign: "right",
      minWidth: 48,
      flexShrink: 0,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    rankPathPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
    },
    rankPathList: {
      gap: ui.spacing.xs,
    },
    rankPathRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
      borderWidth: 1,
      borderColor: softBorder,
      borderRadius: ui.radius.md,
      backgroundColor: tileBackground,
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
    },
    rankPathRowNext: {
      borderStyle: "dashed",
    },
    rankPathStateRail: {
      width: 5,
      alignSelf: "stretch",
      borderRadius: 999,
      borderWidth: 1,
      minHeight: 34,
    },
    rankPathMark: {
      width: 36,
      height: 36,
      borderRadius: ui.radius.sm,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tileBackground,
    },
    rankPathCopy: {
      flex: 1,
      minWidth: 0,
    },
    rankPathName: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    rankPathRange: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 1,
    },
    rankPathStatus: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    rankPathStatusPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "transparent",
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
  });
}
