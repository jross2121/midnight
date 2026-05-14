import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Footer } from "./_components/Footer";
import { getCategoryDisplayNameById } from "./_utils/categoryLabels";
import { localDateKey, parseDateKey } from "./_utils/dateHelpers";
import { withAlpha } from "./_utils/designSystem";
import { DAILY_STANDARD, getDailyScoringTarget } from "./_utils/discipline";
import { questTemplates } from "./_utils/defaultData";
import { getQuestXpForDifficulty } from "./_utils/questXp";
import {
  findDailyQuestLimitConflict,
  formatQuestLimitDate,
  getUpcomingDateKeys,
  MAX_ACTIVE_QUESTS_PER_DAY,
  type QuestLimitConflict,
} from "./_utils/questLimits";
import {
  getQuestRepeatLabel,
  getScheduledQuestsForDate,
  getTodayWeekday,
  normalizeQuestRepeat,
  normalizeScheduledWeekday,
} from "./_utils/recurrence";
import { buildStoredStateFromImport } from "./_utils/storageImport";
import { useTheme, type ThemeColors } from "./_utils/themeContext";
import { STORAGE_KEY, type Quest, type QuestTemplate, type StoredState } from "./_utils/types";

type WeekPlanDay = {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  quests: Quest[];
};

type IconSymbolName = React.ComponentProps<typeof IconSymbol>["name"];

type TodayBrief = {
  eyebrow: string;
  title: string;
  body: string;
  tone: string;
  icon: IconSymbolName;
};

type TemplateRecommendation = {
  template: QuestTemplate;
  label: string;
  score: number;
};

type MetricTileProps = {
  label: string;
  value: string;
  tone: string;
  styles: ReturnType<typeof createPlanStyles>;
};

const PLAN_TONES = {
  gold: "#F5B84B",
  slate: "#8EA0B2",
  warning: "#F472B6",
} as const;

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDayLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function getQuestSortValue(quest: Quest): number {
  if (quest.contract) return 0;
  if (quest.pinned) return 1;
  if (quest.difficulty === "hard") return 2;
  if (quest.difficulty === "medium") return 3;
  return 4;
}

function sortLibraryQuests(quests: Quest[]): Quest[] {
  return [...quests].sort((a, b) => {
    const priority = getQuestSortValue(a) - getQuestSortValue(b);
    if (priority !== 0) return priority;
    return a.title.localeCompare(b.title);
  });
}

function buildEmptyState(): StoredState {
  return buildStoredStateFromImport({});
}

function showQuestLimitAlert(conflict: QuestLimitConflict) {
  Alert.alert(
    "Daily quest limit",
    `${formatQuestLimitDate(conflict.dateKey)} would have ${conflict.totalCount}/${conflict.maxCount} active quests. Rest another quest first.`
  );
}

function getQuestTone(quest: Pick<Quest, "contract" | "difficulty"> & { pinned?: boolean }): string {
  if (quest.contract) return PLAN_TONES.gold;
  if (quest.pinned) return PLAN_TONES.gold;
  return PLAN_TONES.slate;
}

function getQuestIcon(quest: Pick<Quest, "contract" | "categoryId">): IconSymbolName {
  if (quest.contract) return "pin.fill";
  switch (quest.categoryId.trim().toLowerCase()) {
    case "health":
      return "heart.fill";
    case "money":
      return "dollarsign.circle.fill";
    case "career":
      return "briefcase.fill";
    case "social":
      return "bubble.left.fill";
    case "home":
      return "house.fill";
    case "fun":
      return "sparkles";
    default:
      return "flag.fill";
  }
}

function getDayTone(day: WeekPlanDay): string {
  if (day.isToday) return PLAN_TONES.gold;
  if (day.quests.length >= MAX_ACTIVE_QUESTS_PER_DAY) return PLAN_TONES.warning;
  return PLAN_TONES.slate;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function PlanMetricTile({ label, value, tone, styles }: MetricTileProps) {
  return (
    <View style={[styles.heroMetric, { borderColor: withAlpha(tone, 0.28) }]}>
      <Text style={[styles.heroMetricValue, { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.heroMetricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PlanSectionHeader({
  eyebrow,
  title,
  meta,
  styles,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  styles: ReturnType<typeof createPlanStyles>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionHeaderRow, compact && styles.sectionHeaderRowCompact]}>
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{title}</Text>
      </View>
      <View style={[styles.sectionMetaPill, compact && styles.sectionMetaPillCompact]}>
        <Text style={styles.sectionMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function buildTodayBrief({
  todaysQuestCount,
  remainingForStandard,
  exposedContractCount,
  availableContractSlots,
}: {
  todaysQuestCount: number;
  remainingForStandard: number;
  exposedContractCount: number;
  availableContractSlots: number;
}): TodayBrief {
  if (todaysQuestCount === 0) {
    return {
      eyebrow: "Empty Board",
      title: "Build today's run",
      body: "Add one starter and choose one contract before midnight.",
      tone: PLAN_TONES.warning,
      icon: "plus",
    };
  }

  if (exposedContractCount > 0) {
    return {
      eyebrow: "Contract Pressure",
      title: `${pluralize(exposedContractCount, "contract")} exposed`,
      body: "Contracts decide the floor. Clear those before bonus work.",
      tone: PLAN_TONES.gold,
      icon: "pin.fill",
    };
  }

  if (remainingForStandard > 0) {
    return {
      eyebrow: "Daily Standard",
      title: `${pluralize(remainingForStandard, "quest")} to stabilize`,
      body: "Keep the board narrow and finish the smallest useful item next.",
      tone: PLAN_TONES.slate,
      icon: "checkmark.circle.fill",
    };
  }

  if (availableContractSlots > 0) {
    return {
      eyebrow: "Stable Board",
      title: "Daily standard covered",
      body: "The plan is safe. Add pressure only if the contract is real.",
      tone: PLAN_TONES.gold,
      icon: "star.fill",
    };
  }

  return {
    eyebrow: "Locked In",
    title: "Contracts and standard covered",
    body: "Hold this shape. Extra quests are optional XP, not pressure.",
    tone: PLAN_TONES.gold,
    icon: "trophy.fill",
  };
}

function recommendTemplate(
  template: QuestTemplate,
  {
    availableContractSlots,
    remainingForStandard,
    todaysQuestCount,
    todaysCategoryIds,
  }: {
    availableContractSlots: number;
    remainingForStandard: number;
    todaysQuestCount: number;
    todaysCategoryIds: Set<string>;
  }
): TemplateRecommendation {
  if (template.contract && availableContractSlots > 0) {
    return { template, label: "Contract candidate", score: 100 };
  }

  if (todaysQuestCount === 0 && template.difficulty === "easy") {
    return { template, label: "Starter", score: 90 };
  }

  if (remainingForStandard > 0 && template.difficulty === "easy") {
    return { template, label: "Easy standard", score: 82 };
  }

  if (!todaysCategoryIds.has(template.categoryId)) {
    return { template, label: "Category gap", score: 66 };
  }

  if (remainingForStandard === 0 && template.difficulty === "hard") {
    return { template, label: "Pressure option", score: 52 };
  }

  return {
    template,
    label: template.contract ? "Contract-ready" : "Useful extra",
    score: template.contract ? 24 : 20,
  };
}

function PlanSignalBadge({
  icon,
  tone,
  size = "medium",
}: {
  icon: IconSymbolName;
  tone: string;
  size?: "small" | "medium" | "large";
}) {
  const badgeStyles =
    size === "large"
      ? {
          shell: localPlanArtStyles.largeShell,
          ring: localPlanArtStyles.largeRing,
          core: localPlanArtStyles.largeCore,
          notch: localPlanArtStyles.largeNotch,
          iconSize: 28,
        }
      : size === "small"
        ? {
            shell: localPlanArtStyles.smallShell,
            ring: localPlanArtStyles.smallRing,
            core: localPlanArtStyles.smallCore,
            notch: localPlanArtStyles.smallNotch,
            iconSize: 15,
          }
        : {
            shell: localPlanArtStyles.mediumShell,
            ring: localPlanArtStyles.mediumRing,
            core: localPlanArtStyles.mediumCore,
            notch: localPlanArtStyles.mediumNotch,
            iconSize: 20,
          };

  return (
    <View
      style={[
        badgeStyles.shell,
        {
          borderColor: withAlpha(tone, 0.55),
          backgroundColor: withAlpha(tone, 0.11),
        },
      ]}
    >
      <View
        style={[
          badgeStyles.ring,
          {
            borderColor: withAlpha(tone, 0.72),
            backgroundColor: withAlpha(tone, 0.08),
          },
        ]}
      >
        <View style={[badgeStyles.core, { backgroundColor: withAlpha(tone, 0.16) }]}>
          <IconSymbol name={icon} size={badgeStyles.iconSize} color={tone} />
        </View>
      </View>
      <View style={[badgeStyles.notch, { backgroundColor: tone }]} />
    </View>
  );
}

const localPlanArtStyles = StyleSheet.create({
  largeShell: {
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
  mediumShell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediumRing: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  mediumCore: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  mediumNotch: {
    position: "absolute",
    bottom: 5,
    width: 15,
    height: 3,
    borderRadius: 999,
  },
  smallShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallRing: {
    width: 25,
    height: 25,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCore: {
    width: 18,
    height: 18,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  smallNotch: {
    position: "absolute",
    bottom: 3,
    width: 11,
    height: 3,
    borderRadius: 999,
  },
});

function DayPlanCard({ day, styles }: { day: WeekPlanDay; styles: ReturnType<typeof createPlanStyles> }) {
  const totalCount = day.quests.length;
  const isFull = totalCount >= MAX_ACTIVE_QUESTS_PER_DAY;
  const contractCount = day.quests.filter((quest) => quest.contract).length;
  const hardCount = day.quests.filter((quest) => quest.difficulty === "hard").length;
  const completedCount = day.isToday ? day.quests.filter((quest) => quest.done).length : 0;
  const leadQuest = day.quests[0];
  const tone = getDayTone(day);
  const progressPct = Math.min(100, Math.round((totalCount / MAX_ACTIVE_QUESTS_PER_DAY) * 100));

  return (
    <View
      style={[
        styles.dayCard,
        {
          borderColor: withAlpha(tone, day.isToday ? 0.62 : 0.32),
          backgroundColor: withAlpha(tone, day.isToday ? 0.08 : 0.035),
        },
      ]}
    >
      <View style={[styles.dayAccentRail, { backgroundColor: tone }]} />
      <View style={styles.dayTopRow}>
        <View style={styles.dayIdentity}>
          <View style={styles.dayTitleBlock}>
            <Text style={styles.dayLabel}>{day.isToday ? "Today" : day.dayLabel}</Text>
            <Text style={styles.dayDate}>{day.dateLabel}</Text>
          </View>
        </View>
        <View
          style={[
            styles.dayCountPill,
            {
              borderColor: withAlpha(tone, isFull ? 0.62 : 0.36),
              backgroundColor: withAlpha(tone, 0.12),
            },
          ]}
        >
          <Text style={[styles.dayCountText, { color: tone }]}>{totalCount}/{MAX_ACTIVE_QUESTS_PER_DAY}</Text>
        </View>
      </View>

      <View style={styles.dayLoadTrack}>
        <View style={[styles.dayLoadFill, { width: `${progressPct}%`, backgroundColor: tone }]} />
      </View>

      <View style={styles.dayMetricRow}>
        <Text style={styles.dayMetric}>{contractCount} contract</Text>
        <Text style={styles.dayMetric}>{hardCount} hard</Text>
        {day.isToday ? <Text style={styles.dayMetric}>{completedCount} done</Text> : null}
      </View>

      {leadQuest ? (
        <View style={styles.dayQuestLine}>
          <View style={[styles.dayQuestDot, { backgroundColor: getQuestTone(leadQuest) }]} />
          <Text style={styles.dayQuestText} numberOfLines={1}>
            {leadQuest.contract ? "Contract: " : ""}
            {leadQuest.title}
          </Text>
          {day.quests.length > 1 ? (
            <Text style={styles.dayMoreText}>+{day.quests.length - 1}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyLine}>No active quests planned.</Text>
      )}
    </View>
  );
}

function QuestLibraryRow({
  quest,
  colors,
  styles,
  onTogglePause,
  onToggleContract,
}: {
  quest: Quest;
  colors: ThemeColors;
  styles: ReturnType<typeof createPlanStyles>;
  onTogglePause: (questId: string) => void;
  onToggleContract: (questId: string) => void;
}) {
  const tone = getQuestTone(quest);
  const categoryLabel = getCategoryDisplayNameById(quest.categoryId);
  const difficultyLabel = quest.difficulty === "hard" ? "Hard" : quest.difficulty === "medium" ? "Medium" : "Easy";
  const statusLabel = quest.paused ? "Resting" : quest.contract ? "Contract" : quest.pinned ? "Pinned" : null;
  const statusTone = quest.paused ? PLAN_TONES.slate : PLAN_TONES.gold;

  return (
    <View
      style={[
        styles.questRow,
        {
          borderColor: withAlpha(tone, quest.paused ? 0.18 : 0.3),
          backgroundColor: withAlpha(tone, quest.paused ? 0.03 : 0.045),
        },
        quest.paused && styles.questRowPaused,
      ]}
    >
      <View style={[styles.questRowRail, { backgroundColor: tone }]} />
      <View style={styles.questRowTop}>
        <PlanSignalBadge icon={getQuestIcon(quest)} tone={quest.paused ? PLAN_TONES.slate : tone} size="small" />
        <View style={styles.questTitleWrap}>
          <Text style={styles.questTitle} numberOfLines={2}>
            {quest.title}
          </Text>
          <Text style={styles.questMeta} numberOfLines={1}>
            {categoryLabel} - {difficultyLabel} - {quest.xp} XP - {getQuestRepeatLabel(quest)}
          </Text>
        </View>
        {statusLabel ? (
          <View
            style={[
              styles.contractPill,
              {
                borderColor: withAlpha(statusTone, 0.42),
                backgroundColor: withAlpha(statusTone, 0.12),
              },
            ]}
          >
            <Text style={[styles.contractPillText, { color: statusTone }]}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => onTogglePause(quest.id)}
          accessibilityRole="button"
          accessibilityLabel={quest.paused ? `Resume ${quest.title}` : `Rest ${quest.title}`}
          style={({ pressed }) => [
            styles.smallButton,
            quest.paused ? styles.primaryButton : styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.smallButtonText, quest.paused ? { color: colors.bg } : { color: PLAN_TONES.gold }]}>
            {quest.paused ? "Resume" : "Rest"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onToggleContract(quest.id)}
          accessibilityRole="button"
          accessibilityLabel={quest.contract ? `Remove contract from ${quest.title}` : `Make ${quest.title} a contract`}
          style={({ pressed }) => [
            styles.smallButton,
            quest.contract ? styles.secondaryButton : styles.ghostButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.smallButtonText, { color: quest.contract ? PLAN_TONES.gold : colors.textSecondary }]}>
            {quest.contract ? "Remove" : "Contract"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ContractDecisionRow({
  quest,
  colors,
  styles,
  onToggleContract,
}: {
  quest: Quest;
  colors: ThemeColors;
  styles: ReturnType<typeof createPlanStyles>;
  onToggleContract: (questId: string) => void;
}) {
  const tone = quest.contract ? PLAN_TONES.gold : PLAN_TONES.slate;
  const categoryLabel = getCategoryDisplayNameById(quest.categoryId);
  const difficultyLabel = quest.difficulty === "hard" ? "Hard" : quest.difficulty === "medium" ? "Medium" : "Easy";

  return (
    <View
      style={[
        styles.contractDecisionRow,
        {
          borderColor: withAlpha(tone, quest.contract ? 0.42 : 0.24),
          backgroundColor: withAlpha(tone, quest.contract ? 0.09 : 0.035),
        },
      ]}
    >
      <PlanSignalBadge icon={getQuestIcon(quest)} tone={tone} size="small" />
      <View style={styles.contractDecisionCopy}>
        <Text style={styles.contractDecisionTitle} numberOfLines={1}>
          {quest.title}
        </Text>
        <Text style={styles.contractDecisionMeta} numberOfLines={1}>
          {categoryLabel} - {difficultyLabel} - {getQuestRepeatLabel(quest)}
        </Text>
      </View>
      <Pressable
        onPress={() => onToggleContract(quest.id)}
        accessibilityRole="button"
        accessibilityLabel={quest.contract ? `Remove contract from ${quest.title}` : `Make ${quest.title} a contract`}
        style={({ pressed }) => [
          styles.contractDecisionButton,
          quest.contract ? styles.secondaryButton : styles.ghostButton,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.contractDecisionButtonText,
            { color: quest.contract ? PLAN_TONES.gold : colors.textSecondary },
          ]}
        >
          {quest.contract ? "Remove" : "Contract"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createPlanStyles(colors), [colors]);
  const [state, setState] = useState<StoredState>(() => buildEmptyState());
  const [hydrated, setHydrated] = useState(false);

  const loadPlanState = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
      setState(buildStoredStateFromImport(parsed));
    } catch (error) {
      if (__DEV__) console.warn("Failed to load plan state:", error);
      setState(buildEmptyState());
    } finally {
      setHydrated(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlanState();
    }, [loadPlanState])
  );

  const updateStoredState = useCallback((updater: (current: StoredState) => StoredState) => {
    setState((current) => {
      const next = updater(current);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
        if (__DEV__) console.warn("Failed to save plan state:", error);
      });
      return next;
    });
  }, []);

  const today = localDateKey();
  const questLimitDateKeys = useMemo(() => getUpcomingDateKeys(today), [today]);

  const weekPlan = useMemo<WeekPlanDay[]>(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const dateKey = addDaysToDateKey(today, index);
        return {
          dateKey,
          dayLabel: formatDayLabel(dateKey),
          dateLabel: formatDateLabel(dateKey),
          isToday: index === 0,
          quests: getScheduledQuestsForDate(state.quests, dateKey),
        };
      }),
    [state.quests, today]
  );

  const activeQuests = useMemo(
    () => sortLibraryQuests(state.quests.filter((quest) => !quest.paused)),
    [state.quests]
  );
  const pausedQuests = useMemo(
    () => sortLibraryQuests(state.quests.filter((quest) => quest.paused)),
    [state.quests]
  );
  const contractCount = activeQuests.filter((quest) => quest.contract).length;
  const availableContractSlots = Math.max(0, 3 - contractCount);
  const todaysQuests = useMemo(
    () => sortLibraryQuests(weekPlan[0]?.quests ?? []),
    [weekPlan]
  );
  const todaysCompletedCount = todaysQuests.filter((quest) => quest.done).length;
  const todaysTargetCount =
    todaysQuests.length > 0 ? getDailyScoringTarget(todaysQuests.length, DAILY_STANDARD) : 0;
  const remainingForStandard = Math.max(0, todaysTargetCount - todaysCompletedCount);
  const todaysContractQuests = todaysQuests.filter((quest) => quest.contract);
  const todaysContractDoneCount = todaysContractQuests.filter((quest) => quest.done).length;
  const exposedContractCount = todaysContractQuests.filter((quest) => !quest.done).length;
  const openTodayQuests = todaysQuests.filter((quest) => !quest.done);
  const priorityQuests = openTodayQuests.slice(0, 3);
  const leadPriorityQuest = priorityQuests[0] ?? null;
  const weeklyQuestSlots = weekPlan.reduce((sum, day) => sum + day.quests.length, 0);
  const fullestDayCount = weekPlan.reduce(
    (max, day) => Math.max(max, day.quests.length),
    0
  );
  const weeklyLoadPercent = Math.min(
    100,
    Math.round((weeklyQuestSlots / (MAX_ACTIVE_QUESTS_PER_DAY * weekPlan.length)) * 100)
  );
  const maxDayTone = fullestDayCount >= MAX_ACTIVE_QUESTS_PER_DAY ? PLAN_TONES.warning : PLAN_TONES.slate;
  const todayCompletionPercent =
    todaysTargetCount > 0
      ? Math.min(100, Math.round((todaysCompletedCount / todaysTargetCount) * 100))
      : 0;
  const todayBrief = useMemo(
    () =>
      buildTodayBrief({
        todaysQuestCount: todaysQuests.length,
        remainingForStandard,
        exposedContractCount,
        availableContractSlots,
      }),
    [availableContractSlots, exposedContractCount, remainingForStandard, todaysQuests.length]
  );
  const contractQuests = useMemo(
    () => activeQuests.filter((quest) => quest.contract),
    [activeQuests]
  );
  const contractCandidates = useMemo(
    () =>
      availableContractSlots > 0
        ? sortLibraryQuests(activeQuests.filter((quest) => !quest.contract)).slice(0, 4)
        : [],
    [activeQuests, availableContractSlots]
  );
  const rosterQuests = useMemo(
    () =>
      activeQuests.filter(
        (quest) =>
          !quest.contract && !todaysQuests.some((todayQuest) => todayQuest.id === quest.id)
      ),
    [activeQuests, todaysQuests]
  );
  const libraryQuestCount = rosterQuests.length + pausedQuests.length;
  const templateCandidates = useMemo(
    () =>
      questTemplates
        .filter((template) => !state.quests.some((quest) => quest.id.endsWith(`-${template.id}`)))
        .slice(0, 6),
    [state.quests]
  );
  const recommendedTemplates = useMemo(
    () => {
      const todaysCategoryIds = new Set(todaysQuests.map((quest) => quest.categoryId));
      return templateCandidates
        .map((template) =>
          recommendTemplate(template, {
            availableContractSlots,
            remainingForStandard,
            todaysQuestCount: todaysQuests.length,
            todaysCategoryIds,
          })
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
    },
    [availableContractSlots, remainingForStandard, templateCandidates, todaysQuests]
  );

  const toggleQuestPause = useCallback(
    (questId: string) => {
      updateStoredState((current) => {
        const target = current.quests.find((quest) => quest.id === questId);
        if (!target) return current;

        const nextQuests = current.quests.map((quest) =>
          quest.id === questId ? { ...quest, paused: !quest.paused } : quest
        );
        const isResuming = Boolean(target.paused);
        const conflict = isResuming
          ? findDailyQuestLimitConflict(nextQuests, questLimitDateKeys)
          : null;
        if (conflict) {
          showQuestLimitAlert(conflict);
          return current;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return {
          ...current,
          quests: nextQuests,
        };
      });
    },
    [questLimitDateKeys, updateStoredState]
  );

  const toggleQuestContract = useCallback(
    (questId: string) => {
      updateStoredState((current) => {
        const target = current.quests.find((quest) => quest.id === questId);
        if (!target) return current;
        if (target.paused) {
          Alert.alert("Resume first", "Resting quests can become contracts after they return to the active plan.");
          return current;
        }

        const activeContractCount = current.quests.filter(
          (quest) => quest.contract && !quest.paused
        ).length;
        if (!target.contract && activeContractCount >= 3) {
          Alert.alert("Contract limit reached", "Keep the active contract list to three contracts.");
          return current;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return {
          ...current,
          quests: current.quests.map((quest) =>
            quest.id === questId
              ? { ...quest, contract: !quest.contract, pinned: !quest.contract ? true : quest.pinned }
              : quest
          ),
        };
      });
    },
    [updateStoredState]
  );

  const addQuestFromTemplate = useCallback(
    (templateId: string) => {
      const template = questTemplates.find((item) => item.id === templateId);
      if (!template) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateStoredState((current) => {
        if (current.quests.some((quest) => quest.id.endsWith(`-${template.id}`))) {
          return current;
        }

        const activeContracts = current.quests.filter((quest) => quest.contract && !quest.paused).length;
        const shouldContract = Boolean(template.contract) && activeContracts < 3;
        const repeat = normalizeQuestRepeat(template.repeat);
        const nextQuest: Quest = {
          id: `q${Date.now()}-${template.id}`,
          title: template.title,
          categoryId: template.categoryId,
          xp: getQuestXpForDifficulty(template.difficulty),
          target: template.target,
          difficulty: template.difficulty,
          repeat,
          scheduledWeekday:
            repeat === "weekly"
              ? normalizeScheduledWeekday(template.scheduledWeekday, getTodayWeekday())
              : undefined,
          done: false,
          pinned: shouldContract,
          contract: shouldContract,
          paused: false,
        };
        const conflict = findDailyQuestLimitConflict(
          [...current.quests, nextQuest],
          questLimitDateKeys
        );
        if (conflict) {
          showQuestLimitAlert(conflict);
          return current;
        }

        return {
          ...current,
          quests: [
            ...current.quests,
            nextQuest,
          ],
        };
      });
    },
    [questLimitDateKeys, updateStoredState]
  );

  if (!hydrated) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading plan</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <IconSymbol name="calendar" size={18} color={PLAN_TONES.gold} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Plan</Text>
            <Text style={styles.subtitle}>Today, week, and library</Text>
          </View>
        </View>

        <View style={[styles.heroCard, { borderColor: withAlpha(todayBrief.tone, 0.36) }]}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: todayBrief.tone }]}>{todayBrief.eyebrow}</Text>
              <Text style={styles.heroTitle}>{todayBrief.title}</Text>
              <Text style={styles.heroSubtitle}>
                {todayBrief.body}
              </Text>
            </View>
            <View style={[styles.heroScorePlate, { borderColor: withAlpha(todayBrief.tone, 0.34) }]}>
              <Text style={[styles.heroScoreValue, { color: todayBrief.tone }]}>{todayCompletionPercent}%</Text>
              <Text style={styles.heroScoreLabel}>standard</Text>
            </View>
          </View>

          <View style={styles.heroProgressTrack}>
            <View
              style={[
                styles.heroProgressFill,
                {
                  width: `${todayCompletionPercent}%`,
                  backgroundColor: todayBrief.tone,
                },
              ]}
            />
          </View>

          <View style={styles.heroMetricRow}>
            <PlanMetricTile
              label="done"
              value={`${todaysCompletedCount}/${todaysQuests.length}`}
              tone={todayBrief.tone}
              styles={styles}
            />
            <PlanMetricTile
              label="contracts"
              value={todaysContractQuests.length > 0 ? `${todaysContractDoneCount}/${todaysContractQuests.length}` : `${contractCount}/3`}
              tone={PLAN_TONES.gold}
              styles={styles}
            />
            <PlanMetricTile
              label="week load"
              value={`${weeklyLoadPercent}%`}
              tone={maxDayTone}
              styles={styles}
            />
          </View>

          {leadPriorityQuest ? (
            <View style={styles.nextActionPanel}>
              <View style={[styles.nextActionIcon, { borderColor: withAlpha(getQuestTone(leadPriorityQuest), 0.36) }]}>
                <IconSymbol name={getQuestIcon(leadPriorityQuest)} size={16} color={getQuestTone(leadPriorityQuest)} />
              </View>
              <View style={styles.nextActionCopy}>
                <Text style={styles.nextActionLabel}>Next Move</Text>
                <Text style={styles.nextActionTitle} numberOfLines={1}>
                  {leadPriorityQuest.contract ? "Contract: " : ""}
                  {leadPriorityQuest.title}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <PlanSectionHeader
            eyebrow="Today"
            title="Board"
            meta={`${todaysCompletedCount}/${todaysQuests.length} done`}
            styles={styles}
          />
          <View style={styles.questList}>
            {todaysQuests.map((quest) => (
              <QuestLibraryRow
                key={`today-${quest.id}`}
                quest={quest}
                colors={colors}
                styles={styles}
                onTogglePause={toggleQuestPause}
                onToggleContract={toggleQuestContract}
              />
            ))}
            {todaysQuests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No quests scheduled today</Text>
                <Text style={styles.emptyLine}>Add a smart pick or resume something resting.</Text>
              </View>
            ) : null}
          </View>

          {recommendedTemplates.length > 0 ? (
            <View style={styles.sectionSubBlock}>
              <PlanSectionHeader
                eyebrow="Add"
                title="Quick Add"
                meta="smart picks"
                styles={styles}
                compact
              />
              <View style={styles.templateGrid}>
                {recommendedTemplates.map(({ template, label }) => {
                  const tone = getQuestTone(template);
                  return (
                    <Pressable
                      key={template.id}
                      onPress={() => addQuestFromTemplate(template.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${template.title}`}
                      style={({ pressed }) => [
                        styles.templateCard,
                        {
                          borderColor: withAlpha(tone, 0.28),
                          backgroundColor: withAlpha(tone, 0.04),
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.templateTopRow}>
                        <PlanSignalBadge icon={getQuestIcon(template)} tone={tone} size="small" />
                        <View style={styles.templateCopy}>
                          <Text style={styles.templateTitle} numberOfLines={2}>
                            {template.title}
                          </Text>
                          <Text style={styles.templateMeta} numberOfLines={1}>
                            {getCategoryDisplayNameById(template.categoryId)} - {template.xp} XP
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.templateContractPill,
                          {
                            borderColor: withAlpha(tone, 0.34),
                            backgroundColor: withAlpha(tone, 0.11),
                          },
                        ]}
                      >
                        <Text style={[styles.templateContractText, { color: tone }]}>{label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionSubBlock}>
            <PlanSectionHeader
              eyebrow="Protect"
              title="Contracts"
              meta={`${availableContractSlots} open`}
              styles={styles}
              compact
            />
            <View style={styles.contractSlotGrid}>
              {Array.from({ length: 3 }, (_, index) => {
                const quest = contractQuests[index];
                return (
                  <View
                    key={`contract-slot-${index}`}
                    style={[
                      styles.contractSlot,
                      quest ? styles.contractSlotFilled : null,
                    ]}
                  >
                    <Text style={styles.contractSlotLabel}>Slot {index + 1}</Text>
                    <Text style={styles.contractSlotTitle} numberOfLines={1}>
                      {quest?.title ?? "Open"}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.questList}>
              {contractQuests.map((quest) => (
                <ContractDecisionRow
                  key={`contract-${quest.id}`}
                  quest={quest}
                  colors={colors}
                  styles={styles}
                  onToggleContract={toggleQuestContract}
                />
              ))}
              {contractCandidates.length > 0 ? (
                <View style={styles.contractCandidateGroup}>
                  <Text style={styles.priorityLabel}>Candidates</Text>
                  {contractCandidates.map((quest) => (
                    <ContractDecisionRow
                      key={`contract-candidate-${quest.id}`}
                      quest={quest}
                      colors={colors}
                      styles={styles}
                      onToggleContract={toggleQuestContract}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <PlanSectionHeader eyebrow="Week" title="Outlook" meta={`${weeklyQuestSlots} slots`} styles={styles} />
          <View style={styles.weekSignalRail}>
            {weekPlan.map((day) => {
              const tone = getDayTone(day);
              return (
                <View key={day.dateKey} style={styles.weekSignalColumn}>
                  <View
                    style={[
                      styles.weekSignalDot,
                      {
                        backgroundColor: tone,
                        opacity: day.quests.length > 0 || day.isToday ? 1 : 0.36,
                      },
                    ]}
                  />
                  <Text style={[styles.weekSignalLabel, day.isToday && { color: PLAN_TONES.gold }]}>
                    {day.isToday ? "Now" : day.dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.dayGrid}>
            {weekPlan.map((day) => (
              <DayPlanCard key={day.dateKey} day={day} styles={styles} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <PlanSectionHeader
            eyebrow="Library"
            title="Quest Library"
            meta={`${libraryQuestCount} not today`}
            styles={styles}
          />
          <View style={styles.questList}>
            {rosterQuests.map((quest) => (
              <QuestLibraryRow
                key={`roster-${quest.id}`}
                quest={quest}
                colors={colors}
                styles={styles}
                onTogglePause={toggleQuestPause}
                onToggleContract={toggleQuestContract}
              />
            ))}
            {pausedQuests.map((quest) => (
              <QuestLibraryRow
                key={`paused-${quest.id}`}
                quest={quest}
                colors={colors}
                styles={styles}
                onTogglePause={toggleQuestPause}
                onToggleContract={toggleQuestContract}
              />
            ))}
            {libraryQuestCount === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Library clear</Text>
                <Text style={styles.emptyLine}>Everything active is already on today&apos;s board.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}

function createPlanStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 112,
      gap: 18,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(PLAN_TONES.gold, 0.22),
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(PLAN_TONES.gold, 0.34),
      backgroundColor: withAlpha(PLAN_TONES.gold, 0.11),
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 32,
      lineHeight: 36,
      fontWeight: "900",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    heroCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(PLAN_TONES.gold, 0.3),
      backgroundColor: withAlpha(colors.surface2, 0.94),
      padding: 16,
      gap: 14,
    },
    heroHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroEyebrow: {
      color: PLAN_TONES.gold,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "900",
      marginTop: 2,
    },
    heroSubtitle: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "800",
      marginTop: 4,
    },
    heroScorePlate: {
      minWidth: 82,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: withAlpha(colors.bg, 0.28),
      paddingHorizontal: 10,
      paddingVertical: 9,
      alignItems: "center",
    },
    heroScoreValue: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "900",
    },
    heroScoreLabel: {
      color: colors.textSecondary,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
      marginTop: 1,
    },
    heroProgressTrack: {
      height: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      backgroundColor: withAlpha(colors.bg, 0.64),
      overflow: "hidden",
    },
    heroProgressFill: {
      height: "100%",
      borderRadius: 999,
    },
    nextActionPanel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(PLAN_TONES.gold, 0.2),
      backgroundColor: withAlpha(colors.bg, 0.26),
      padding: 10,
    },
    nextActionIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.bg, 0.22),
    },
    nextActionCopy: {
      flex: 1,
      minWidth: 0,
    },
    nextActionLabel: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    nextActionTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      marginTop: 1,
    },
    weekSignalRail: {
      flexDirection: "row",
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.18),
      backgroundColor: withAlpha(colors.bg, 0.22),
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    weekSignalColumn: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 4,
    },
    weekSignalDot: {
      width: "100%",
      height: 8,
      borderRadius: 999,
    },
    weekSignalLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    heroMetricRow: {
      flexDirection: "row",
      gap: 8,
    },
    heroMetric: {
      flex: 1,
      borderRadius: 8,
      backgroundColor: withAlpha(colors.bg, 0.3),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      paddingVertical: 9,
      paddingHorizontal: 9,
      minWidth: 0,
    },
    heroMetricValue: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    heroMetricLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "900",
      marginTop: 2,
      textTransform: "uppercase",
    },
    section: {
      gap: 9,
    },
    sectionSubBlock: {
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.16),
      paddingTop: 10,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionHeaderRowCompact: {
      alignItems: "flex-start",
    },
    sectionTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    sectionEyebrow: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.65,
      textTransform: "uppercase",
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
      marginTop: 1,
    },
    sectionTitleCompact: {
      fontSize: 16,
      lineHeight: 20,
    },
    sectionMetaPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(PLAN_TONES.gold, 0.22),
      backgroundColor: withAlpha(PLAN_TONES.gold, 0.065),
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    sectionMetaPillCompact: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    sectionMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "800",
    },
    dayGrid: {
      gap: 8,
    },
    priorityPanel: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(PLAN_TONES.gold, 0.24),
      backgroundColor: withAlpha(PLAN_TONES.gold, 0.055),
      padding: 12,
      gap: 8,
    },
    priorityLabel: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
    },
    priorityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      minWidth: 0,
    },
    priorityNumber: {
      width: 22,
      height: 22,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(PLAN_TONES.gold, 0.3),
      textAlign: "center",
      lineHeight: 20,
      fontSize: 11,
      fontWeight: "900",
      overflow: "hidden",
    },
    priorityText: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    dayCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.surface, 0.9),
      paddingHorizontal: 11,
      paddingVertical: 10,
      gap: 7,
      overflow: "hidden",
    },
    dayAccentRail: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    dayTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    dayIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dayTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    dayLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: "900",
    },
    dayDate: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      marginTop: 1,
    },
    dayCountPill: {
      minWidth: 38,
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    dayCountText: {
      fontSize: 14,
      fontWeight: "900",
    },
    dayLoadTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.58),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.16),
      overflow: "hidden",
    },
    dayLoadFill: {
      height: "100%",
      borderRadius: 999,
    },
    dayMetricRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    dayMetric: {
      color: colors.textSecondary,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
    },
    dayQuestLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      minWidth: 0,
    },
    dayQuestDot: {
      width: 6,
      height: 6,
      borderRadius: 999,
    },
    dayQuestText: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "700",
    },
    dayMoreText: {
      color: PLAN_TONES.gold,
      fontSize: 12,
      fontWeight: "800",
    },
    questList: {
      gap: 10,
    },
    contractCandidateGroup: {
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.18),
      paddingTop: 10,
    },
    contractSlotGrid: {
      flexDirection: "row",
      gap: 8,
    },
    contractSlot: {
      flex: 1,
      minWidth: 0,
      minHeight: 62,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      backgroundColor: withAlpha(colors.surface, 0.72),
      paddingHorizontal: 9,
      paddingVertical: 8,
      justifyContent: "center",
    },
    contractSlotFilled: {
      borderColor: withAlpha(PLAN_TONES.gold, 0.36),
      backgroundColor: withAlpha(PLAN_TONES.gold, 0.08),
    },
    contractSlotLabel: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    contractSlotTitle: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
      marginTop: 3,
    },
    contractDecisionRow: {
      minHeight: 62,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    contractDecisionCopy: {
      flex: 1,
      minWidth: 0,
    },
    contractDecisionTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    contractDecisionMeta: {
      color: colors.textSecondary,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      marginTop: 2,
    },
    contractDecisionButton: {
      minHeight: 32,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    contractDecisionButtonText: {
      fontSize: 11,
      lineHeight: 13,
      fontWeight: "900",
    },
    questRow: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.surface, 0.9),
      padding: 12,
      gap: 12,
      position: "relative",
      overflow: "hidden",
    },
    questRowRail: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
    },
    questRowPaused: {
      opacity: 0.72,
      backgroundColor: withAlpha(colors.surface2, 0.58),
    },
    questRowTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    questTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    questTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "900",
    },
    questMeta: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    contractPill: {
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    contractPillText: {
      fontSize: 10,
      fontWeight: "900",
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "flex-end",
    },
    smallButton: {
      minHeight: 34,
      borderRadius: 8,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    primaryButton: {
      backgroundColor: PLAN_TONES.gold,
      borderColor: PLAN_TONES.gold,
    },
    secondaryButton: {
      backgroundColor: withAlpha(PLAN_TONES.gold, 0.08),
      borderColor: withAlpha(PLAN_TONES.gold, 0.3),
    },
    ghostButton: {
      backgroundColor: withAlpha(colors.bg, 0.22),
      borderColor: withAlpha(colors.border, 0.24),
    },
    smallButtonText: {
      fontSize: 12,
      fontWeight: "900",
    },
    pressed: {
      opacity: 0.72,
    },
    emptyCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      backgroundColor: withAlpha(colors.surface, 0.62),
      padding: 14,
      gap: 4,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "900",
    },
    emptyLine: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    templateGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    templateCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.surface, 0.82),
      padding: 12,
      gap: 6,
      width: "48.4%",
      minHeight: 112,
      justifyContent: "space-between",
    },
    templateTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    templateCopy: {
      flex: 1,
      minWidth: 0,
    },
    templateTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "900",
    },
    templateMeta: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    templateContractPill: {
      alignSelf: "flex-start",
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    templateContractText: {
      fontSize: 10,
      fontWeight: "900",
    },
  });
}
