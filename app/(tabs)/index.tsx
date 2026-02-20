import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddQuestForm } from "./_components/AddQuestForm";
import { EditQuestForm } from "./_components/EditQuestForm";
import { Footer } from "./_components/Footer";
import { QuestCard } from "./_components/QuestCard";
import { RankBadge } from "./_components/RankBadge";
import { createStyles } from "./_styles";
import { diffDays, localDateKey, parseDateKey } from "./_utils/dateHelpers";
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
import { ui } from "./_utils/designSystem";
import {
  DAILY_STANDARD,
  formatDelta,
  getCompletionPercent,
  getCountdownToMidnight,
  getDRChangeFromPercent,
} from "./_utils/discipline";
import { levelUp } from "./_utils/gameHelpers";
import { getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Achievement, Category, DrHistoryEntry, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

function applyDrChange(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isDrHistoryEntry(value: unknown): value is DrHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DrHistoryEntry>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.dr === "number" &&
    typeof candidate.delta === "number" &&
    typeof candidate.pct === "number"
  );
}

function loadDrHistory(value: unknown): DrHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry))
    .slice(-30);
}

/* =======================
   SCREEN
======================= */
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const drHeroAnim = useRef(new Animated.Value(0)).current;
  const [judgmentCountdown, setJudgmentCountdown] = useState(getCountdownToMidnight());
  const [showDevActions, setShowDevActions] = useState(false);

  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [lastResetDate, setLastResetDate] = useState<string>(localDateKey());
  const [hydrated, setHydrated] = useState(false);

  const [disciplineRating, setDisciplineRating] = useState<number>(defaultDisciplineRating);
  const [lastDrDelta, setLastDrDelta] = useState<number>(defaultLastDrDelta);
  const [lastCompletionPct, setLastCompletionPct] = useState<number>(defaultLastCompletionPct);
  const [lastDrUpdateDate, setLastDrUpdateDate] = useState<string>(defaultLastDrUpdateDate);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);

  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newXP, setNewXP] = useState("10");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");

  // Edit quest state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [openQuestId, setOpenQuestId] = useState<string | null>(null);

  const normalizeDifficulty = (d: unknown): "easy" | "medium" | "hard" => {
    if (d === "medium" || d === "hard") return d;
    return "easy";
  };

  function getDifficultyMultiplier(difficulty: "easy" | "medium" | "hard") {
    switch (difficulty) {
      case "easy":
        return 1;
      case "medium":
        return 1.5;
      case "hard":
        return 2;
    }
  }

  const unlockAchievement = (achievementId: string) => {
    setAchievements((prev) =>
      prev.map((a) =>
        a.id === achievementId && !a.unlockedAt
          ? { ...a, unlockedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const checkAchievements = (updatedQuests: typeof quests, updatedCategories: typeof categories) => {
    const completedTotal = updatedQuests.filter((q) => q.done).length;
    const todayXPTotal = updatedQuests.filter((q) => q.done).reduce((sum, q) => sum + q.xp, 0);
    const questsDone = updatedQuests.filter((q) => q.done);

    // first_quest: Complete first quest
    if (completedTotal === 1 && !achievements.find((a) => a.id === "first_quest")?.unlockedAt) {
      unlockAchievement("first_quest");
    }

    // hard_mode: Complete hard difficulty quest
    if (
      questsDone.some((q) => q.difficulty === "hard") &&
      !achievements.find((a) => a.id === "hard_mode")?.unlockedAt
    ) {
      unlockAchievement("hard_mode");
    }

    // 100_xp: Earn 100 XP in single day
    if (todayXPTotal >= 100 && !achievements.find((a) => a.id === "100_xp")?.unlockedAt) {
      unlockAchievement("100_xp");
    }

    // perfect_day: Complete all quests in one day
    if (
      updatedQuests.length > 0 &&
      updatedQuests.every((q) => q.done) &&
      !achievements.find((a) => a.id === "perfect_day")?.unlockedAt
    ) {
      unlockAchievement("perfect_day");
    }

    // level_5: Reach level 5 in any category
    if (
      updatedCategories.some((c) => c.level >= 5) &&
      !achievements.find((a) => a.id === "level_5")?.unlockedAt
    ) {
      unlockAchievement("level_5");
    }

    // all_categories: Level 3 in all categories
    if (
      updatedCategories.every((c) => c.level >= 3) &&
      updatedCategories.length > 0 &&
      !achievements.find((a) => a.id === "all_categories")?.unlockedAt
    ) {
      unlockAchievement("all_categories");
    }

    // 30_quests: Complete 30 quests total
    if (completedTotal >= 30 && !achievements.find((a) => a.id === "30_quests")?.unlockedAt) {
      unlockAchievement("30_quests");
    }

  };

  /*
    DEV TEST CHECKLIST:
    a) Complete some quests, change device date to tomorrow, relaunch app:
       expect DR recap line + DR delta + one new DR history entry.
    b) Skip 2 days, relaunch app:
       expect multiple missed-day entries in DR history with pct=0 and delta=-8.
  */
  // LOAD (and apply daily reset if needed + update DR)
  useEffect(() => {
    (async () => {
      const today = localDateKey();

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) {
          setLastResetDate(today);
          setHydrated(true);
          return;
        }

        const parsed = JSON.parse(raw) as Partial<StoredState>;

        const loadedCategories =
          Array.isArray(parsed.categories) && parsed.categories.length
            ? parsed.categories
            : defaultCategories;

        const loadedQuests =
          Array.isArray(parsed.quests) && parsed.quests.length
            ? parsed.quests
            : defaultQuests;

        const savedResetDate =
          typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : today;

        const loadedAchievements = Array.isArray(parsed.achievements)
          ? parsed.achievements
          : defaultAchievements;

        const loadedDR =
          typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : defaultDisciplineRating;
        const loadedLastDrDelta =
          typeof parsed.lastDrDelta === "number" ? parsed.lastDrDelta : defaultLastDrDelta;
        const loadedLastCompletionPct =
          typeof parsed.lastCompletionPct === "number"
            ? Math.max(0, Math.min(100, Math.round(parsed.lastCompletionPct)))
            : defaultLastCompletionPct;
        const loadedLastDrUpdateDate =
          typeof parsed.lastDrUpdateDate === "string" ? parsed.lastDrUpdateDate : defaultLastDrUpdateDate;
        const loadedHistory = loadDrHistory(parsed.drHistory);

        const gap = diffDays(savedResetDate, today);

        let nextDR = loadedDR;
        let nextLastDrDelta = loadedLastDrDelta;
        let nextLastCompletionPct = loadedLastCompletionPct;
        let nextLastDrUpdateDate = loadedLastDrUpdateDate;
        let nextHistory = loadedHistory;

        if (gap >= 1) {
          // Day 1 (the "previous day" based on saved quests)
          const donePrev = loadedQuests.filter((q) => q.done).length;
          const pctPrev = getCompletionPercent(donePrev, DAILY_STANDARD);
          const deltaPrev = getDRChangeFromPercent(pctPrev, loadedQuests.length, DAILY_STANDARD);
          nextDR = applyDrChange(nextDR, deltaPrev);
          nextHistory = [
            ...nextHistory,
            {
              date: savedResetDate,
              dr: nextDR,
              delta: deltaPrev,
              pct: pctPrev,
            },
          ];

          // Additional missed days (if you were away multiple days)
          // Treat each missed day as 0% => -8
          for (let i = 1; i < gap; i++) {
            const missedDate = addDaysToDateKey(savedResetDate, i);
            nextDR = applyDrChange(nextDR, -8);
            nextHistory.push({
              date: missedDate,
              dr: nextDR,
              delta: -8,
              pct: 0,
            });
          }

          if (nextHistory.length > 30) {
            nextHistory = nextHistory.slice(-30);
          }

          const latestEntry = nextHistory[nextHistory.length - 1];
          if (latestEntry) {
            nextLastDrDelta = latestEntry.delta;
            nextLastCompletionPct = latestEntry.pct;
          }
          nextLastDrUpdateDate = today;
        }

        // Daily reset + normalize difficulty
        const finalQuests =
          savedResetDate !== today
            ? loadedQuests.map((q) => ({ ...q, done: false }))
            : loadedQuests;

        const normalizedFinalQuests = finalQuests.map((q) => ({
          ...q,
          difficulty: normalizeDifficulty(q.difficulty),
          pinned: Boolean(q.pinned),
          target: typeof q.target === "string" ? q.target : "",
        }));

        setCategories(loadedCategories);
        setQuests(normalizedFinalQuests);
        setAchievements(loadedAchievements);
        setDisciplineRating(nextDR);
        setLastDrDelta(nextLastDrDelta);
        setLastCompletionPct(nextLastCompletionPct);
        setLastDrUpdateDate(nextLastDrUpdateDate);
        setDrHistory(nextHistory);
        setLastResetDate(today);
      } catch (e) {
        console.log("Failed to load storage:", e);
        setLastResetDate(today);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // SAVE on changes
  useEffect(() => {
    if (!hydrated) return;

    (async () => {
      try {
        const state: StoredState = {
          categories,
          quests,
          lastResetDate,
          achievements,
          disciplineRating,
          lastDrDelta,
          lastCompletionPct,
          lastDrUpdateDate,
          drHistory,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.log("Failed to save storage:", e);
      }
    })();
  }, [
    categories,
    quests,
    lastResetDate,
    achievements,
    disciplineRating,
    lastDrDelta,
    lastCompletionPct,
    lastDrUpdateDate,
    drHistory,
    hydrated,
  ]);

  useEffect(() => {
    Animated.timing(drHeroAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [drHeroAnim]);

  useEffect(() => {
    const interval = setInterval(() => {
      setJudgmentCountdown(getCountdownToMidnight());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const doneCount = useMemo(() => quests.filter((q) => q.done).length, [quests]);
  const doneForStandard = useMemo(() => Math.min(doneCount, DAILY_STANDARD), [doneCount]);
  const todayCompletionPercent = useMemo(
    () => getCompletionPercent(doneCount, DAILY_STANDARD),
    [doneCount]
  );
  const projectedDelta = useMemo(
    () => getDRChangeFromPercent(todayCompletionPercent, quests.length, DAILY_STANDARD),
    [todayCompletionPercent, quests.length]
  );
  const rankName = useMemo(() => getRankFromDR(disciplineRating), [disciplineRating]);
  const rankLabel = rankName.toUpperCase();
  const rankMeta = useMemo(() => getRankMeta(rankName), [rankName]);
  const nextRank = useMemo(() => getNextRank(disciplineRating), [disciplineRating]);
  const projectionColor =
    projectedDelta > 0 ? colors.positive : projectedDelta < 0 ? colors.negative : colors.textSecondary;

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Category";

  const completeQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.done) return;

    // Add haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const difficultyMultiplier = getDifficultyMultiplier(quest.difficulty);
    const xpAwarded = Math.floor(quest.xp * difficultyMultiplier);

    const updatedQuests = quests.map((q) =>
      q.id === questId ? { ...q, done: true } : q
    );

    const updatedCategories = categories.map((c) =>
      c.id === quest.categoryId ? levelUp({ ...c, xp: c.xp + xpAwarded }) : c
    );

    setQuests(updatedQuests);
    setCategories(updatedCategories);
    checkAchievements(updatedQuests, updatedCategories);
    setOpenQuestId(null);
  };

  const deleteQuest = (questId: string) => {
    setQuests((prev) => prev.filter((q) => q.id !== questId));
    setOpenQuestId((prev) => (prev === questId ? null : prev));
  };

  const editQuest = (
    questId: string,
    title: string,
    categoryId: string,
    xp: number,
    difficulty: "easy" | "medium" | "hard",
    target: string
  ) => {
    const safeDifficulty = normalizeDifficulty(difficulty);
    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId
          ? { ...q, title, categoryId, xp, difficulty: safeDifficulty, target }
          : q
      )
    );
    setEditingQuestId(null);
    setOpenQuestId(null);
  };

  const resetToday = () => {
    setQuests((prev) => prev.map((q) => ({ ...q, done: false })));
    setLastResetDate(localDateKey());
  };

  const togglePin = (questId: string) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, pinned: !q.pinned } : q))
    );
  };

  const toggleQuestOpen = (questId: string) => {
    setOpenQuestId((prev) => (prev === questId ? null : questId));
  };

  useEffect(() => {
    if (!openQuestId) return;
    if (!quests.some((q) => q.id === openQuestId)) {
      setOpenQuestId(null);
    }
  }, [openQuestId, quests]);

  const resetDemo = async () => {
    const resetCategories = defaultCategories.map((c) => ({
      ...c,
      level: 0,
      xp: 0,
      xpToNext: 90,
    }));
    setCategories(resetCategories);
    setQuests(defaultQuests);

    // wipe DR
    setDisciplineRating(defaultDisciplineRating);
    setLastDrDelta(defaultLastDrDelta);
    setLastCompletionPct(defaultLastCompletionPct);
    setLastDrUpdateDate(defaultLastDrUpdateDate);
    setDrHistory(defaultDrHistory);

    setShowAdd(false);
    setEditingQuestId(null);
    setOpenQuestId(null);
    setNewTitle("");
    setNewCategory("health");
    setNewXP("10");
    setNewDifficulty("easy");
    setLastResetDate(localDateKey());

    // Save reset state to AsyncStorage
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          categories: resetCategories,
          quests: defaultQuests,
          achievements: defaultAchievements,
          disciplineRating: defaultDisciplineRating,
          lastDrDelta: defaultLastDrDelta,
          lastCompletionPct: defaultLastCompletionPct,
          lastDrUpdateDate: defaultLastDrUpdateDate,
          drHistory: defaultDrHistory,
          lastResetDate: localDateKey(),
        })
      );
    } catch (e) {
      console.error("Failed to save reset state:", e);
    }
  };

  const addQuest = () => {
    const title = newTitle.trim();
    if (!title) return;

    const xpNum = Number(newXP);
    const safeXP = Number.isFinite(xpNum) && xpNum > 0 ? Math.floor(xpNum) : 10;

    const safeDifficulty = normalizeDifficulty(newDifficulty);
    setQuests((prev) => [
      ...prev,
      {
        id: "q" + Date.now(),
        title,
        categoryId: newCategory,
        xp: safeXP,
        target: "",
        difficulty: safeDifficulty,
        done: false,
        pinned: false,
      },
    ]);

    setNewTitle("");
    setNewXP("10");
    setNewDifficulty("easy");
    setShowAdd(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: "transparent" }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.sectionBand, styles.sectionBandTight]}>
            <View style={styles.homeTopBar}>
              <Pressable onLongPress={() => __DEV__ && setShowDevActions((prev) => !prev)}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>MIDNIGHT</Text>
              </Pressable>
              <Pressable onPress={() => undefined} hitSlop={8}>
                <Text style={styles.homeSubtitle}>Performance Log</Text>
              </Pressable>
            </View>

            <View style={styles.statusHeader}>
              <View style={styles.statusHeaderTop}>
                <View style={styles.rankBadgeRail}>
                  <RankBadge rankTier={rankMeta.tier} size={36} active />
                </View>
                <View style={styles.statusHeaderMain}>
                  <Text style={styles.statusLabel}>DISCIPLINE RATING</Text>
                  <Animated.Text
                    style={[
                      styles.statusDrValue,
                      {
                        color: colors.textPrimary,
                        opacity: drHeroAnim,
                        transform: [
                          {
                            scale: drHeroAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.985, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {disciplineRating}
                  </Animated.Text>
                  <View style={styles.statusRankRow}>
                    <Text style={styles.statusRankName}>{rankLabel}</Text>
                    {nextRank ? (
                      <Text style={styles.statusRankNext}>+{nextRank.remainingDr} → {nextRank.name.toUpperCase()}</Text>
                    ) : (
                      <Text style={styles.statusRankNext}>TOP RANK</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.midnightStrip}>
                <View style={styles.midnightCell}>
                  <Text style={styles.midnightLabel}>JUDGMENT IN</Text>
                  <Text style={styles.midnightValue}>{judgmentCountdown}</Text>
                </View>
                <View style={[styles.midnightCell, styles.midnightCellRight]}>
                  <Text style={styles.midnightLabel}>NEXT UPDATE</Text>
                  <Text style={[styles.midnightUpdateValue, { color: projectionColor }]}>{formatDelta(projectedDelta)}</Text>
                </View>
              </View>

              <View style={styles.progressMicroRow}>
                <View style={styles.progressMicroItem}>
                  <Text style={styles.progressMicroLabel}>COMPLETION</Text>
                  <Text style={styles.progressMicroValue}>{todayCompletionPercent}%</Text>
                </View>
                <View style={styles.progressMicroItem}>
                  <Text style={styles.progressMicroLabel}>DONE</Text>
                  <Text style={styles.progressMicroValue}>{doneForStandard}/{DAILY_STANDARD}</Text>
                </View>
              </View>
            </View>

            {__DEV__ && showDevActions ? (
              <View style={styles.devActionRow}>
                <Pressable style={styles.devActionChip} onPress={resetToday}>
                  <Text style={styles.devActionText}>Reset Today</Text>
                </Pressable>
                <Pressable style={styles.devActionChip} onPress={resetDemo}>
                  <Text style={styles.devActionText}>Reset Demo</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionBand, { marginTop: ui.spacing.md }]}>
            {/* TODAY'S QUESTS HEADER */}
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionSecondary, { marginBottom: 0 }]}>Daily Inputs</Text>
              <Pressable onPress={() => setShowAdd((s) => !s)}>
                <Text style={[styles.link, { color: colors.accentPrimary }]}>{showAdd ? "Cancel" : "+ Add"}</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionSubtext}>
              Priority list for today.
            </Text>

            {/* ADD/EDIT QUEST FORM */}
            {showAdd && (
              <AddQuestForm
                categories={categories}
                newTitle={newTitle}
                newCategory={newCategory}
                newXP={newXP}
                newDifficulty={newDifficulty}
                onTitleChange={setNewTitle}
                onCategoryChange={setNewCategory}
                onXPChange={setNewXP}
                onDifficultyChange={setNewDifficulty}
                onAdd={addQuest}
              />
            )}

            {editingQuestId && (
              <EditQuestForm
                quest={quests.find((q) => q.id === editingQuestId)!}
                categories={categories}
                onSave={editQuest}
                onCancel={() => setEditingQuestId(null)}
              />
            )}

            {/* QUEST LIST */}
            <View style={styles.list}>
              {[...quests]
                .sort((a, b) => {
                  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                  if (a.done !== b.done) return Number(a.done) - Number(b.done);
                  return 0;
                })
                .map((q) => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    categoryName={categoryName(q.categoryId)}
                    isOpen={openQuestId === q.id}
                    onToggle={toggleQuestOpen}
                    onComplete={completeQuest}
                    onEdit={(questId) => {
                      setEditingQuestId(questId);
                      setOpenQuestId(null);
                    }}
                    onPin={togglePin}
                    onDelete={deleteQuest}
                  />
                ))}
            </View>
            <View style={styles.homeHintCard}>
              <Text style={styles.homeHintText}>
                DR updates only at midnight judgment.
              </Text>
            </View>
            <Footer />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


