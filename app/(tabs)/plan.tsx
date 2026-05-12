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
import { STORAGE_KEY, type Quest, type StoredState } from "./_utils/types";

type WeekPlanDay = {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  quests: Quest[];
};

type IconSymbolName = React.ComponentProps<typeof IconSymbol>["name"];

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
    `${formatQuestLimitDate(conflict.dateKey)} would have ${conflict.totalCount}/${conflict.maxCount} active quests. Pause or move a quest first.`
  );
}

function getQuestTone(quest: Pick<Quest, "contract" | "difficulty">): string {
  if (quest.contract) return PLAN_TONES.gold;
  return PLAN_TONES.slate;
}

function getQuestIcon(quest: Pick<Quest, "contract" | "difficulty">): IconSymbolName {
  if (quest.contract) return "pin.fill";
  if (quest.difficulty === "hard") return "trophy.fill";
  if (quest.difficulty === "medium") return "star.fill";
  return "checkmark.circle.fill";
}

function getDayTone(day: WeekPlanDay): string {
  if (day.isToday) return PLAN_TONES.gold;
  if (day.quests.length >= MAX_ACTIVE_QUESTS_PER_DAY) return PLAN_TONES.warning;
  return PLAN_TONES.slate;
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
  const topQuests = day.quests.slice(0, 3);
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
          <PlanSignalBadge icon={day.isToday ? "calendar" : "checkmark.circle.fill"} tone={tone} size="small" />
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

      {topQuests.length > 0 ? (
        <View style={styles.dayQuestList}>
          {topQuests.map((quest) => (
            <View key={`${day.dateKey}-${quest.id}`} style={styles.dayQuestLine}>
              <View style={[styles.dayQuestDot, { backgroundColor: getQuestTone(quest) }]} />
              <Text style={styles.dayQuestText} numberOfLines={1}>
                {quest.contract ? "Contract: " : ""}
                {quest.title}
              </Text>
            </View>
          ))}
          {day.quests.length > topQuests.length ? (
            <Text style={styles.dayMoreText}>+{day.quests.length - topQuests.length} more</Text>
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
      <View style={styles.questRowTop}>
        <PlanSignalBadge icon={getQuestIcon(quest)} tone={quest.paused ? PLAN_TONES.slate : tone} size="medium" />
        <View style={styles.questTitleWrap}>
          <Text style={styles.questTitle} numberOfLines={2}>
            {quest.title}
          </Text>
          <Text style={styles.questMeta} numberOfLines={1}>
            {categoryLabel} - {difficultyLabel} - {quest.xp} XP - {getQuestRepeatLabel(quest)}
          </Text>
        </View>
        {quest.contract ? (
          <View
            style={[
              styles.contractPill,
              {
                borderColor: withAlpha(PLAN_TONES.gold, 0.42),
                backgroundColor: withAlpha(PLAN_TONES.gold, 0.12),
              },
            ]}
          >
            <Text style={[styles.contractPillText, { color: PLAN_TONES.gold }]}>Contract</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => onTogglePause(quest.id)}
          accessibilityRole="button"
          accessibilityLabel={quest.paused ? `Resume ${quest.title}` : `Pause ${quest.title}`}
          style={({ pressed }) => [
            styles.smallButton,
            quest.paused ? styles.primaryButton : styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.smallButtonText, quest.paused ? { color: colors.bg } : { color: PLAN_TONES.gold }]}>
            {quest.paused ? "Resume" : "Pause"}
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
            {quest.contract ? "Unpledge" : "Pledge"}
          </Text>
        </Pressable>
      </View>
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
      console.log("Failed to load plan state:", error);
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
        console.log("Failed to save plan state:", error);
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
  const templateCandidates = useMemo(
    () =>
      questTemplates
        .filter((template) => !state.quests.some((quest) => quest.id.endsWith(`-${template.id}`)))
        .slice(0, 6),
    [state.quests]
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
          Alert.alert("Resume first", "Paused quests can be pledged after they return to the active plan.");
          return current;
        }

        const activeContractCount = current.quests.filter(
          (quest) => quest.contract && !quest.paused
        ).length;
        if (!target.contract && activeContractCount >= 3) {
          Alert.alert("Contract limit reached", "Keep the active contract list to three promises.");
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
            <Text style={styles.subtitle}>Weekly plan and quest library</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <PlanSignalBadge icon="calendar" tone={PLAN_TONES.gold} size="large" />
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Planning Signal</Text>
              <Text style={styles.heroTitle}>{weeklyQuestSlots} quest slots this week</Text>
              <Text style={styles.heroSubtitle}>
                {weeklyLoadPercent}% weekly load - {contractCount}/3 contracts protected
              </Text>
            </View>
          </View>
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
          <View style={styles.heroMetricRow}>
            <View style={[styles.heroMetric, { borderColor: withAlpha(PLAN_TONES.gold, 0.26) }]}>
              <Text style={[styles.heroMetricValue, { color: PLAN_TONES.gold }]}>{activeQuests.length}</Text>
              <Text style={styles.heroMetricLabel}>active</Text>
            </View>
            <View style={[styles.heroMetric, { borderColor: withAlpha(PLAN_TONES.gold, 0.3) }]}>
              <Text style={[styles.heroMetricValue, { color: PLAN_TONES.gold }]}>{contractCount}/3</Text>
              <Text style={styles.heroMetricLabel}>contracts</Text>
            </View>
            <View style={[styles.heroMetric, { borderColor: withAlpha(PLAN_TONES.slate, 0.22) }]}>
              <Text style={[styles.heroMetricValue, { color: PLAN_TONES.slate }]}>{pausedQuests.length}</Text>
              <Text style={styles.heroMetricLabel}>paused</Text>
            </View>
            <View style={[styles.heroMetric, { borderColor: withAlpha(maxDayTone, 0.26) }]}>
              <Text style={[styles.heroMetricValue, { color: maxDayTone }]}>{fullestDayCount}/{MAX_ACTIVE_QUESTS_PER_DAY}</Text>
              <Text style={styles.heroMetricLabel}>max day</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Week Ahead</Text>
            <Text style={styles.sectionMeta}>7 days</Text>
          </View>
          <View style={styles.dayGrid}>
            {weekPlan.map((day) => (
              <DayPlanCard key={day.dateKey} day={day} styles={styles} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quest Library</Text>
            <Text style={styles.sectionMeta}>{activeQuests.length} active</Text>
          </View>
          <View style={styles.questList}>
            {activeQuests.map((quest) => (
              <QuestLibraryRow
                key={quest.id}
                quest={quest}
                colors={colors}
                styles={styles}
                onTogglePause={toggleQuestPause}
                onToggleContract={toggleQuestContract}
              />
            ))}
            {activeQuests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No active quests</Text>
                <Text style={styles.emptyLine}>Resume a paused quest or add a template below.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Paused</Text>
            <Text style={styles.sectionMeta}>{pausedQuests.length} resting</Text>
          </View>
          <View style={styles.questList}>
            {pausedQuests.map((quest) => (
              <QuestLibraryRow
                key={quest.id}
                quest={quest}
                colors={colors}
                styles={styles}
                onTogglePause={toggleQuestPause}
                onToggleContract={toggleQuestContract}
              />
            ))}
            {pausedQuests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nothing paused</Text>
                <Text style={styles.emptyLine}>Pause quests when the week needs less pressure.</Text>
              </View>
            ) : null}
          </View>
        </View>

        {templateCandidates.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Plan Boosters</Text>
              <Text style={styles.sectionMeta}>templates</Text>
            </View>
            <View style={styles.templateGrid}>
              {templateCandidates.map((template) => {
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
                    {template.contract ? (
                      <View
                        style={[
                          styles.templateContractPill,
                          {
                            borderColor: withAlpha(PLAN_TONES.gold, 0.34),
                            backgroundColor: withAlpha(PLAN_TONES.gold, 0.11),
                          },
                        ]}
                      >
                        <Text style={[styles.templateContractText, { color: PLAN_TONES.gold }]}>Contract-ready</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

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
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 120,
      gap: 22,
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
      paddingBottom: 2,
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
      fontSize: 34,
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
      backgroundColor: withAlpha(colors.surface2, 0.88),
      padding: 16,
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
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 4,
      textTransform: "uppercase",
      letterSpacing: 0.25,
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
      gap: 10,
    },
    heroMetric: {
      flex: 1,
      borderRadius: 8,
      backgroundColor: withAlpha(colors.bg, 0.3),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    heroMetricValue: {
      color: colors.textPrimary,
      fontSize: 18,
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
      gap: 10,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "900",
    },
    sectionMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "800",
    },
    dayGrid: {
      gap: 10,
    },
    dayCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.surface, 0.9),
      padding: 12,
      gap: 10,
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
      gap: 12,
    },
    dayIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    dayTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    dayLabel: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "900",
    },
    dayDate: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    dayCountPill: {
      minWidth: 38,
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    dayCountText: {
      fontSize: 14,
      fontWeight: "900",
    },
    dayLoadTrack: {
      height: 7,
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
      gap: 8,
    },
    dayMetric: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "800",
    },
    dayQuestList: {
      gap: 4,
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
    questRow: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.surface, 0.9),
      padding: 12,
      gap: 12,
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
      gap: 10,
    },
    templateCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.surface, 0.82),
      padding: 12,
      gap: 6,
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
