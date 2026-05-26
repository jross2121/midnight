import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "./_components/ScreenHeader";
import { CONTRACT_GOLD, HOME_GOLD } from "./_styles";
import { getAchievementsAfterQuestCompletion, mergeAchievements } from "./_utils/achievements";
import { getCategoryDisplayName } from "./_utils/categoryLabels";
import { localDateKey } from "./_utils/dateHelpers";
import {
  defaultAchievements,
  defaultCategories,
  defaultDisciplineRating,
  defaultDrHistory,
  defaultLastCompletionPct,
  defaultLastDrDelta,
  defaultLastDrUpdateDate,
  defaultQuests,
} from "./_utils/defaultData";
import { createCardSurface, createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { levelUp } from "./_utils/gameHelpers";
import { getQuestXpForDifficulty } from "./_utils/questXp";
import { getQuestRepeatLabel, getScheduledQuestsForDate } from "./_utils/recurrence";
import { useTheme, type ThemeColors } from "./_utils/themeContext";
import {
  STORAGE_KEY,
  type Achievement,
  type ArchivedQuest,
  type Category,
  type DrHistoryEntry,
  type Quest,
  type StoredState,
} from "./_utils/types";

const FOCUS_DURATION_OPTIONS = [
  { label: "5m", seconds: 5 * 60 },
  { label: "15m", seconds: 15 * 60 },
  { label: "25m", seconds: 25 * 60 },
  { label: "45m", seconds: 45 * 60 },
];
const DEFAULT_FOCUS_SECONDS = 25 * 60;

function formatFocusTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sortFocusQuests(quests: Quest[]): Quest[] {
  return [...quests].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.contract !== b.contract) return a.contract ? -1 : 1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const weight = { hard: 3, medium: 2, easy: 1 };
    return weight[b.difficulty] - weight[a.difficulty];
  });
}

function buildStoredState(
  parsed: Partial<StoredState>,
  nextValues: {
    categories: Category[];
    quests: Quest[];
    achievements: Achievement[];
    lifetimeCompletedQuestCount: number;
  }
): StoredState {
  const nextState: StoredState = {
    categories: nextValues.categories,
    quests: nextValues.quests,
    achievements: nextValues.achievements,
    lifetimeCompletedQuestCount: nextValues.lifetimeCompletedQuestCount,
    disciplineRating:
      typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : defaultDisciplineRating,
    lastDrDelta: typeof parsed.lastDrDelta === "number" ? parsed.lastDrDelta : defaultLastDrDelta,
    lastCompletionPct:
      typeof parsed.lastCompletionPct === "number" ? parsed.lastCompletionPct : defaultLastCompletionPct,
    lastDrUpdateDate:
      typeof parsed.lastDrUpdateDate === "string" ? parsed.lastDrUpdateDate : defaultLastDrUpdateDate,
    drHistory: Array.isArray(parsed.drHistory) ? (parsed.drHistory as DrHistoryEntry[]) : defaultDrHistory,
    lastResetDate: typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : localDateKey(),
    archivedQuests: Array.isArray(parsed.archivedQuests)
      ? (parsed.archivedQuests as ArchivedQuest[])
      : [],
  };

  if (Array.isArray(parsed.equippedBadgeIds)) {
    nextState.equippedBadgeIds = parsed.equippedBadgeIds.slice(0, 3);
  }

  return nextState;
}

export default function FocusScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createFocusStyles(colors), [colors]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [lifetimeCompletedQuestCount, setLifetimeCompletedQuestCount] = useState(0);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_FOCUS_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const loadFocusState = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
      const loadedCategories = Array.isArray(parsed.categories) ? parsed.categories : defaultCategories;
      const loadedQuests = Array.isArray(parsed.quests) ? parsed.quests : defaultQuests;
      const loadedAchievements = mergeAchievements(parsed.achievements);
      const loadedLifetime =
        typeof parsed.lifetimeCompletedQuestCount === "number"
          ? Math.max(0, Math.floor(parsed.lifetimeCompletedQuestCount))
          : 0;

      setCategories(loadedCategories);
      setQuests(loadedQuests);
      setAchievements(loadedAchievements);
      setLifetimeCompletedQuestCount(loadedLifetime);
      setHydrated(true);
    } catch (error) {
      if (__DEV__) console.warn("Failed to load focus state:", error);
      setHydrated(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFocusState();
    }, [loadFocusState])
  );

  const activeQuests = useMemo(
    () => sortFocusQuests(getScheduledQuestsForDate(quests, localDateKey()).filter((quest) => !quest.done)),
    [quests]
  );
  const selectedQuest = useMemo(
    () => activeQuests.find((quest) => quest.id === selectedQuestId) ?? activeQuests[0] ?? null,
    [activeQuests, selectedQuestId]
  );
  const categoryName = useCallback(
    (id: string) => getCategoryDisplayName(categories.find((category) => category.id === id) ?? { id, name: "Category" }),
    [categories]
  );

  const progress = durationSeconds <= 0 ? 0 : Math.min(1, Math.max(0, (durationSeconds - remainingSeconds) / durationSeconds));
  const focusComplete = Boolean(selectedQuest) && remainingSeconds === 0;
  const statusLabel = !selectedQuest
    ? "Idle"
    : focusComplete
      ? "Complete"
      : running
        ? "Running"
        : remainingSeconds < durationSeconds
          ? "Paused"
          : "Ready";

  useEffect(() => {
    if (!selectedQuest && activeQuests.length > 0) {
      setSelectedQuestId(activeQuests[0].id);
    }
  }, [activeQuests, selectedQuest]);

  useEffect(() => {
    setRunning(false);
    setRemainingSeconds(durationSeconds);
  }, [durationSeconds, selectedQuest?.id]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (running && remainingSeconds === 0) {
      setRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [remainingSeconds, running]);

  const selectQuest = (questId: string) => {
    if (running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedQuestId(questId);
  };

  const selectDuration = (seconds: number) => {
    if (running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDurationSeconds(seconds);
  };

  const toggleSprint = () => {
    if (!selectedQuest) return;
    Haptics.impactAsync(running ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    if (remainingSeconds === 0) {
      setRemainingSeconds(durationSeconds);
    }
    setRunning((current) => !current);
  };

  const resetSprint = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRunning(false);
    setRemainingSeconds(durationSeconds);
  };

  const completeSelectedQuest = async () => {
    if (!selectedQuest) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
      const nextQuests = quests.map((quest) =>
        quest.id === selectedQuest.id ? { ...quest, done: true } : quest
      );
      const previousCategories = categories;
      const nextCategories = categories.map((category) =>
        category.id === selectedQuest.categoryId
          ? levelUp({ ...category, xp: category.xp + getQuestXpForDifficulty(selectedQuest.difficulty) })
          : category
      );
      const nextLifetimeCompletedQuestCount = lifetimeCompletedQuestCount + 1;
      const nextAchievements = getAchievementsAfterQuestCompletion({
        achievements,
        quests: nextQuests,
        categories: nextCategories,
        previousCategories,
        lifetimeCompletedQuestCount: nextLifetimeCompletedQuestCount,
      });

      const nextState = buildStoredState(parsed, {
        categories: nextCategories,
        quests: nextQuests,
        achievements: nextAchievements,
        lifetimeCompletedQuestCount: nextLifetimeCompletedQuestCount,
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));

      const nextActiveQuests = sortFocusQuests(
        getScheduledQuestsForDate(nextQuests, localDateKey()).filter((quest) => !quest.done)
      );
      setQuests(nextQuests);
      setCategories(nextCategories);
      setAchievements(nextAchievements);
      setLifetimeCompletedQuestCount(nextLifetimeCompletedQuestCount);
      setSelectedQuestId(nextActiveQuests[0]?.id ?? null);
      setRunning(false);
      setRemainingSeconds(durationSeconds);
    } catch (error) {
      if (__DEV__) console.warn("Failed to complete focused quest:", error);
      Alert.alert("Quest update failed", "Could not complete that quest from Focus Sprint.");
    }
  };

  if (!hydrated) {
    return null;
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title="Focus Sprint" subtitle="Single-task timer" icon="timer" />

        <View style={styles.timerPanel}>
          <View style={styles.timerTopRow}>
            <Text style={styles.eyebrow}>Current Sprint</Text>
            <View
              style={[
                styles.statusPill,
                running && styles.statusPillRunning,
                focusComplete && styles.statusPillComplete,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  running && styles.statusTextRunning,
                  focusComplete && styles.statusTextComplete,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.timerText}>{formatFocusTime(remainingSeconds)}</Text>
          <Text style={styles.timerMeta}>{Math.round(durationSeconds / 60)} minute sprint</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: focusComplete ? colors.positive : HOME_GOLD,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.targetPanel}>
          <Text style={styles.eyebrow}>Target</Text>
          <Text style={styles.targetTitle} numberOfLines={2}>
            {selectedQuest?.title ?? "No active task"}
          </Text>
          <Text style={styles.targetMeta}>
            {selectedQuest
              ? `${categoryName(selectedQuest.categoryId)} - ${selectedQuest.difficulty.toUpperCase()} - ${selectedQuest.xp} XP - ${getQuestRepeatLabel(selectedQuest)}`
              : "Run complete"}
          </Text>
        </View>

        <View style={styles.durationRow}>
          {FOCUS_DURATION_OPTIONS.map((option) => {
            const active = option.seconds === durationSeconds;
            return (
              <Pressable
                key={option.seconds}
                onPress={() => selectDuration(option.seconds)}
                disabled={running}
                accessibilityRole="button"
                accessibilityLabel={`Set focus sprint to ${option.label}`}
                style={[
                  styles.durationChip,
                  active && styles.durationChipActive,
                  running && styles.controlDisabled,
                ]}
              >
                <Text style={[styles.durationText, active && styles.durationTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={toggleSprint}
            disabled={!selectedQuest}
            accessibilityRole="button"
            accessibilityLabel={running ? "Pause focus sprint" : "Start focus sprint"}
            style={[styles.primaryButton, !selectedQuest && styles.controlDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {running ? "Pause" : remainingSeconds === 0 ? "Restart" : "Start"}
            </Text>
          </Pressable>
          <Pressable
            onPress={resetSprint}
            disabled={!selectedQuest || remainingSeconds === durationSeconds}
            accessibilityRole="button"
            accessibilityLabel="Reset focus sprint"
            style={[
              styles.secondaryButton,
              (!selectedQuest || remainingSeconds === durationSeconds) && styles.controlDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={completeSelectedQuest}
            disabled={!selectedQuest}
            accessibilityRole="button"
            accessibilityLabel={selectedQuest ? `Complete focused task: ${selectedQuest.title}` : "No focused task"}
            style={[
              styles.secondaryButton,
              focusComplete && styles.completeButton,
              !selectedQuest && styles.controlDisabled,
            ]}
          >
            <Text style={[styles.secondaryButtonText, focusComplete && styles.completeButtonText]}>
              Complete
            </Text>
          </Pressable>
        </View>

        <View style={styles.taskList}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Task Deck</Text>
            <Text style={styles.sectionMeta}>{activeQuests.length}</Text>
          </View>
          {activeQuests.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Run complete</Text>
              <Text style={styles.emptyMeta}>No active tasks remain for today.</Text>
            </View>
          ) : (
            activeQuests.map((quest) => {
              const selected = selectedQuest?.id === quest.id;
              const questTone = quest.contract ? CONTRACT_GOLD : HOME_GOLD;
              return (
                <Pressable
                  key={quest.id}
                  onPress={() => selectQuest(quest.id)}
                  disabled={running}
                  accessibilityRole="button"
                  accessibilityLabel={`Focus on ${quest.title}`}
                  style={[
                    styles.taskRow,
                    selected && styles.taskRowSelected,
                    selected && quest.contract && {
                      borderColor: withAlpha(CONTRACT_GOLD, 0.48),
                      backgroundColor: withAlpha(CONTRACT_GOLD, 0.09),
                    },
                    running && !selected && styles.taskRowDisabled,
                  ]}
                >
                  <View
                    style={[
                      styles.taskIcon,
                      selected && styles.taskIconSelected,
                      selected && quest.contract && {
                        borderColor: withAlpha(CONTRACT_GOLD, 0.4),
                        backgroundColor: withAlpha(CONTRACT_GOLD, 0.12),
                      },
                    ]}
                  >
                    <IconSymbol
                      name={quest.contract ? "shield.fill" : quest.pinned ? "star.fill" : "checkmark.circle.fill"}
                      size={18}
                      color={selected ? questTone : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.taskCopy}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {quest.title}
                    </Text>
                    <Text style={styles.taskMeta} numberOfLines={1}>
                      {categoryName(quest.categoryId)} - {quest.difficulty.toUpperCase()} - {quest.xp} XP
                    </Text>
                  </View>
                  <Text style={[styles.taskState, selected && styles.taskStateSelected, selected && quest.contract && { color: CONTRACT_GOLD }]}>
                    {selected ? "Locked" : "Select"}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createFocusStyles(colors: ThemeColors) {
  const cardSurface = createCardSurface(colors, {
    padding: ui.spacing.card,
    radius: ui.radius.card,
    borderOpacity: 0.24,
    glowOpacity: 0.025,
    backgroundColor: withAlpha(colors.surface2, 0.8),
  });
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
      paddingBottom: ui.spacing.lg,
      gap: ui.spacing.sm,
    },
    timerPanel: {
      ...cardSurface,
      borderColor: withAlpha(HOME_GOLD, 0.28),
      backgroundColor: withAlpha(colors.surface2, 0.88),
      gap: ui.spacing.xs,
    },
    timerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    eyebrow: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    statusPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.28),
      backgroundColor: withAlpha(colors.bg, 0.28),
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusPillRunning: {
      borderColor: withAlpha(HOME_GOLD, 0.5),
      backgroundColor: withAlpha(HOME_GOLD, 0.13),
    },
    statusPillComplete: {
      borderColor: withAlpha(colors.positive, 0.48),
      backgroundColor: withAlpha(colors.positive, 0.12),
    },
    statusText: {
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    statusTextRunning: {
      color: HOME_GOLD,
    },
    statusTextComplete: {
      color: colors.positive,
    },
    timerText: {
      color: HOME_GOLD,
      fontSize: 64,
      lineHeight: 70,
      fontWeight: "900",
      fontFamily: "monospace",
      textAlign: "center",
      marginTop: ui.spacing.xs,
    },
    timerMeta: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      textAlign: "center",
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.68),
      overflow: "hidden",
      marginTop: ui.spacing.xs,
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
    },
    targetPanel: {
      ...cardSurface,
      gap: 4,
    },
    targetTitle: {
      color: colors.textPrimary,
      fontSize: 21,
      lineHeight: 25,
      fontWeight: "900",
    },
    targetMeta: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    durationRow: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    durationChip: {
      flex: 1,
      minHeight: 38,
      borderRadius: ui.radius.button,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.bg, 0.3),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.xs,
    },
    durationChipActive: {
      borderColor: withAlpha(HOME_GOLD, 0.48),
      backgroundColor: withAlpha(HOME_GOLD, 0.12),
    },
    durationText: {
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    durationTextActive: {
      color: colors.textPrimary,
    },
    actionRow: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    primaryButton: {
      flex: 1.15,
      minHeight: 42,
      borderRadius: ui.radius.button,
      backgroundColor: HOME_GOLD,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.sm,
    },
    primaryButtonText: {
      color: colors.bg,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: ui.radius.button,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.28),
      backgroundColor: withAlpha(colors.bg, 0.3),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.xs,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
    },
    completeButton: {
      borderColor: withAlpha(colors.positive, 0.38),
      backgroundColor: withAlpha(colors.positive, 0.12),
    },
    completeButtonText: {
      color: colors.positive,
    },
    controlDisabled: {
      opacity: 0.45,
    },
    taskList: {
      gap: ui.spacing.xs,
      marginTop: ui.spacing.xs,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    sectionMeta: {
      color: HOME_GOLD,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
    },
    taskRow: {
      ...tileSurface,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      minHeight: 70,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
    },
    taskRowSelected: {
      borderColor: withAlpha(HOME_GOLD, 0.48),
      backgroundColor: withAlpha(HOME_GOLD, 0.09),
    },
    taskRowDisabled: {
      opacity: 0.5,
    },
    taskIcon: {
      width: 42,
      height: 42,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.bg, 0.3),
    },
    taskIconSelected: {
      borderColor: withAlpha(HOME_GOLD, 0.4),
      backgroundColor: withAlpha(HOME_GOLD, 0.12),
    },
    taskCopy: {
      flex: 1,
      minWidth: 0,
    },
    taskTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "900",
    },
    taskMeta: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 3,
      textTransform: "uppercase",
    },
    taskState: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    taskStateSelected: {
      color: HOME_GOLD,
    },
    emptyPanel: {
      ...cardSurface,
      alignItems: "center",
      gap: 4,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    emptyMeta: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
    },
  });
}
