import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "./_components/ScreenHeader";
import { ScreenLoading } from "./_components/ScreenLoading";
import { CONTRACT_GOLD, HOME_GOLD } from "./_styles";
import { getCategoryDisplayName } from "./_utils/categoryLabels";
import { localDateKey } from "./_utils/dateHelpers";
import {
  defaultCategories,
  defaultQuests,
} from "./_utils/defaultData";
import { createCardSurface, createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { completeQuestInStoredState } from "./_utils/questCompletion";
import { getQuestRepeatLabel, getScheduledQuestsForDate } from "./_utils/recurrence";
import { readStoredState, updateStoredState } from "./_utils/storedState";
import { useTheme, type ThemeColors } from "./_utils/themeContext";
import {
  type Category,
  type Quest,
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
    const weight = { hard: 3, medium: 2, easy: 1 };
    return weight[b.difficulty] - weight[a.difficulty];
  });
}

export default function FocusScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createFocusStyles(colors), [colors]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_FOCUS_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/more");
  };

  const loadFocusState = useCallback(async () => {
    try {
      const storedState = await readStoredState();
      const loadedCategories = storedState.categories;
      const loadedQuests = storedState.quests;

      setCategories(loadedCategories);
      setQuests(loadedQuests);
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
    deadlineRef.current = null;
    setRunning(false);
    setRemainingSeconds(durationSeconds);
  }, [durationSeconds, selectedQuest?.id]);

  useEffect(() => {
    if (!running || deadlineRef.current === null) return;
    const syncRemainingTime = () => {
      if (deadlineRef.current === null) return;
      setRemainingSeconds(
        Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      );
    };
    syncRemainingTime();
    const interval = setInterval(syncRemainingTime, 500);

    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active" && running && deadlineRef.current !== null) {
        setRemainingSeconds(
          Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
        );
      }
    });

    return () => subscription.remove();
  }, [running]);

  useEffect(() => {
    if (running && remainingSeconds === 0) {
      deadlineRef.current = null;
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
    if (running) {
      if (deadlineRef.current !== null) {
        setRemainingSeconds(
          Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
        );
      }
      deadlineRef.current = null;
      setRunning(false);
      return;
    }

    const nextRemainingSeconds = remainingSeconds === 0 ? durationSeconds : remainingSeconds;
    setRemainingSeconds(nextRemainingSeconds);
    deadlineRef.current = Date.now() + nextRemainingSeconds * 1000;
    setRunning(true);
  };

  const resetSprint = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deadlineRef.current = null;
    setRunning(false);
    setRemainingSeconds(durationSeconds);
  };

  const completeSelectedQuest = async () => {
    if (!selectedQuest || isCompleting) return;

    setIsCompleting(true);
    try {
      let completed = false;
      const nextState = await updateStoredState((current) => {
        const result = completeQuestInStoredState(current, selectedQuest.id, localDateKey());
        completed = result.completed;
        return result.state;
      });

      if (!completed) {
        await loadFocusState();
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const nextActiveQuests = sortFocusQuests(
        getScheduledQuestsForDate(nextState.quests, localDateKey()).filter((quest) => !quest.done)
      );
      setQuests(nextState.quests);
      setCategories(nextState.categories);
      setSelectedQuestId(nextActiveQuests[0]?.id ?? null);
      deadlineRef.current = null;
      setRunning(false);
      setRemainingSeconds(durationSeconds);
    } catch (error) {
      if (__DEV__) console.warn("Failed to complete focused quest:", error);
      Alert.alert("Quest update failed", "Could not complete that quest from Focus Sprint.");
    } finally {
      setIsCompleting(false);
    }
  };

  if (!hydrated) {
    return <ScreenLoading label="Loading focus sprint" />;
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Focus Sprint"
          subtitle="Single-task timer"
          icon="chevron.left"
          onIconPress={navigateBack}
          iconAccessibilityLabel="Go back"
        />

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
                accessibilityState={{ selected: active, disabled: running }}
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
            accessibilityState={{ disabled: !selectedQuest }}
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
            accessibilityState={{ disabled: !selectedQuest || remainingSeconds === durationSeconds }}
            style={[
              styles.secondaryButton,
              (!selectedQuest || remainingSeconds === durationSeconds) && styles.controlDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={completeSelectedQuest}
            disabled={!selectedQuest || isCompleting}
            accessibilityRole="button"
            accessibilityLabel={selectedQuest ? `Complete focused task: ${selectedQuest.title}` : "No focused task"}
            accessibilityState={{ disabled: !selectedQuest || isCompleting }}
            style={[
              styles.secondaryButton,
              focusComplete && styles.completeButton,
              (!selectedQuest || isCompleting) && styles.controlDisabled,
            ]}
          >
            <Text style={[styles.secondaryButtonText, focusComplete && styles.completeButtonText]}>
              {isCompleting ? "Saving..." : "Complete"}
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
              <Text style={styles.emptyTitle}>{quests.length === 0 ? "No tasks yet" : "Run complete"}</Text>
              <Text style={styles.emptyMeta}>
                {quests.length === 0
                  ? "Add a quest from Today before starting a Focus Sprint."
                  : "No active tasks remain for today."}
              </Text>
              {quests.length === 0 ? (
                <Pressable
                  style={styles.emptyAction}
                  onPress={() => router.replace("/(tabs)")}
                  accessibilityRole="button"
                  accessibilityLabel="Open Today to add a quest"
                >
                  <Text style={styles.emptyActionText}>Open Today</Text>
                </Pressable>
              ) : null}
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
                  accessibilityState={{ selected, disabled: running }}
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
                      name={quest.contract ? "shield.fill" : "checkmark.circle.fill"}
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
      minHeight: 44,
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
      minHeight: 48,
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
      minHeight: 48,
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
      textAlign: "center",
    },
    emptyAction: {
      minHeight: 44,
      marginTop: ui.spacing.xs,
      borderRadius: ui.radius.button,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.4),
      backgroundColor: withAlpha(HOME_GOLD, 0.12),
      paddingHorizontal: ui.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyActionText: {
      color: HOME_GOLD,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
    },
  });
}
