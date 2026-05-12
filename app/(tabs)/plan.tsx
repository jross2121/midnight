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

function DayPlanCard({ day, colors, styles }: { day: WeekPlanDay; colors: ThemeColors; styles: ReturnType<typeof createPlanStyles> }) {
  const totalCount = day.quests.length;
  const isFull = totalCount >= MAX_ACTIVE_QUESTS_PER_DAY;
  const contractCount = day.quests.filter((quest) => quest.contract).length;
  const hardCount = day.quests.filter((quest) => quest.difficulty === "hard").length;
  const completedCount = day.isToday ? day.quests.filter((quest) => quest.done).length : 0;
  const topQuests = day.quests.slice(0, 3);

  return (
    <View style={[styles.dayCard, day.isToday && { borderColor: withAlpha(colors.accentPrimary, 0.55) }]}>
      <View style={styles.dayTopRow}>
        <View>
          <Text style={styles.dayLabel}>{day.isToday ? "Today" : day.dayLabel}</Text>
          <Text style={styles.dayDate}>{day.dateLabel}</Text>
        </View>
        <View
          style={[
            styles.dayCountPill,
            isFull && { borderColor: withAlpha(colors.accentPrimary, 0.5) },
          ]}
        >
          <Text style={styles.dayCountText}>{totalCount}/{MAX_ACTIVE_QUESTS_PER_DAY}</Text>
        </View>
      </View>

      <View style={styles.dayMetricRow}>
        <Text style={styles.dayMetric}>{contractCount} contract</Text>
        <Text style={styles.dayMetric}>{hardCount} hard</Text>
        {day.isToday ? <Text style={styles.dayMetric}>{completedCount} done</Text> : null}
      </View>

      {topQuests.length > 0 ? (
        <View style={styles.dayQuestList}>
          {topQuests.map((quest) => (
            <Text key={`${day.dateKey}-${quest.id}`} style={styles.dayQuestText} numberOfLines={1}>
              {quest.contract ? "Contract: " : ""}
              {quest.title}
            </Text>
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
  return (
    <View style={[styles.questRow, quest.paused && styles.questRowPaused]}>
      <View style={styles.questRowTop}>
        <View style={styles.questTitleWrap}>
          <Text style={styles.questTitle} numberOfLines={2}>
            {quest.title}
          </Text>
          <Text style={styles.questMeta} numberOfLines={1}>
            {getCategoryDisplayNameById(quest.categoryId)} - {quest.difficulty.toUpperCase()} - {quest.xp} XP - {getQuestRepeatLabel(quest)}
          </Text>
        </View>
        {quest.contract ? (
          <View style={styles.contractPill}>
            <Text style={styles.contractPillText}>Contract</Text>
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
          <Text style={[styles.smallButtonText, quest.paused ? { color: colors.bg } : { color: colors.accentPrimary }]}>
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
          <Text style={[styles.smallButtonText, { color: quest.contract ? colors.accentPrimary : colors.textSecondary }]}>
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
          <Text style={styles.title}>Plan</Text>
          <Text style={styles.subtitle}>Weekly plan and quest library</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Planning Signal</Text>
          <Text style={styles.heroTitle}>{weeklyQuestSlots} quest slots this week</Text>
          <View style={styles.heroMetricRow}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{activeQuests.length}</Text>
              <Text style={styles.heroMetricLabel}>active</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{contractCount}/3</Text>
              <Text style={styles.heroMetricLabel}>contracts</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{pausedQuests.length}</Text>
              <Text style={styles.heroMetricLabel}>paused</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{fullestDayCount}/{MAX_ACTIVE_QUESTS_PER_DAY}</Text>
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
              <DayPlanCard key={day.dateKey} day={day} colors={colors} styles={styles} />
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
              {templateCandidates.map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => addQuestFromTemplate(template.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${template.title}`}
                  style={({ pressed }) => [styles.templateCard, pressed && styles.pressed]}
                >
                  <Text style={styles.templateTitle} numberOfLines={2}>
                    {template.title}
                  </Text>
                  <Text style={styles.templateMeta}>
                    {getCategoryDisplayNameById(template.categoryId)} - {template.xp} XP
                  </Text>
                  {template.contract ? (
                    <View style={styles.templateContractPill}>
                      <Text style={styles.templateContractText}>Contract-ready</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
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
      gap: 4,
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
      borderColor: withAlpha(colors.accentPrimary, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.86),
      padding: 16,
      gap: 12,
    },
    heroEyebrow: {
      color: colors.accentPrimary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "900",
    },
    heroMetricRow: {
      flexDirection: "row",
      gap: 10,
    },
    heroMetric: {
      flex: 1,
      borderRadius: 8,
      backgroundColor: withAlpha(colors.bg, 0.34),
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
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2,
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
    },
    dayTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
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
      backgroundColor: withAlpha(colors.accentPrimary, 0.13),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.28),
      paddingVertical: 6,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    dayCountText: {
      color: colors.accentPrimary,
      fontSize: 14,
      fontWeight: "900",
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
    dayQuestText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    dayMoreText: {
      color: colors.accentPrimary,
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
      backgroundColor: withAlpha(colors.accentPrimary, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.3),
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    contractPillText: {
      color: colors.accentPrimary,
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
      backgroundColor: colors.accentPrimary,
      borderColor: colors.accentPrimary,
    },
    secondaryButton: {
      backgroundColor: withAlpha(colors.accentPrimary, 0.08),
      borderColor: withAlpha(colors.accentPrimary, 0.3),
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
      borderColor: withAlpha(colors.accentPrimary, 0.3),
      backgroundColor: withAlpha(colors.accentPrimary, 0.1),
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    templateContractText: {
      color: colors.accentPrimary,
      fontSize: 10,
      fontWeight: "900",
    },
  });
}
