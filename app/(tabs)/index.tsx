import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { AddQuestForm } from "./_components/AddQuestForm";
import { EditQuestForm } from "./_components/EditQuestForm";
import { Footer } from "./_components/Footer";
import { QuestCard } from "./_components/QuestCard";
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
import { levelUp } from "./_utils/gameHelpers";
import { getNextRank, getRankEmoji, getRankFromDR } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Achievement, Category, DrHistoryEntry, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

/* =======================
   DR HELPERS
======================= */
function drDeltaFromCompletion(done: number, total: number): number {
  if (total <= 0) return -8; // no quests => treat as 0%
  if (done <= 0) return -8; // 0%

  if (done >= total) return +10; // 100%

  const pct = (done / total) * 100;

  if (pct >= 1 && pct <= 29) return -4;
  if (pct >= 30 && pct <= 59) return 0;
  if (pct >= 60 && pct <= 84) return +4;
  if (pct >= 85 && pct <= 99) return +7;

  // Safety fallback (shouldn't hit)
  return 0;
}

function applyDrChange(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

function completionPct(done: number, total: number): number {
  if (total <= 0 || done <= 0) return 0;
  const pct = Math.round((done / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
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

  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [lastResetDate, setLastResetDate] = useState<string>(localDateKey());
  const [hydrated, setHydrated] = useState(false);
  const [todayCardSize, setTodayCardSize] = useState<{ width: number; height: number } | null>(null);

  const [disciplineRating, setDisciplineRating] = useState<number>(defaultDisciplineRating);
  const [lastDrDelta, setLastDrDelta] = useState<number>(defaultLastDrDelta);
  const [lastCompletionPct, setLastCompletionPct] = useState<number>(defaultLastCompletionPct);
  const [lastDrUpdateDate, setLastDrUpdateDate] = useState<string>(defaultLastDrUpdateDate);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [lastFinalizedCounts, setLastFinalizedCounts] = useState<{ done: number; total: number } | null>(null);

  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newXP, setNewXP] = useState("10");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");

  // Edit quest state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);

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
          const totalPrev = loadedQuests.length;
          const pctPrev = completionPct(donePrev, totalPrev);
          const deltaPrev = drDeltaFromCompletion(donePrev, totalPrev);
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
          setLastFinalizedCounts({ done: donePrev, total: totalPrev });

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
        } else {
          setLastFinalizedCounts(null);
        }

        // ✅ Daily reset + normalize difficulty
        const finalQuests =
          savedResetDate !== today
            ? loadedQuests.map((q) => ({ ...q, done: false }))
            : loadedQuests;

        const normalizedFinalQuests = finalQuests.map((q) => ({
          ...q,
          difficulty: normalizeDifficulty(q.difficulty),
          pinned: Boolean(q.pinned),
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

  const overall = useMemo(() => {
    const totalLevel = categories.reduce((sum, c) => sum + c.level, 0);
    const avg = categories.length ? totalLevel / categories.length : 0;
    return Math.round(avg * 10) / 10;
  }, [categories]);

  const doneCount = useMemo(() => quests.filter((q) => q.done).length, [quests]);
  const rankName = useMemo(() => getRankFromDR(disciplineRating), [disciplineRating]);
  const nextRank = useMemo(() => getNextRank(disciplineRating), [disciplineRating]);
  const todayProgress = useMemo(() => {
    if (!quests.length) return 0;
    return Math.min(1, Math.max(0, doneCount / quests.length));
  }, [doneCount, quests.length]);
  const recapCounts = useMemo(() => {
    if (lastFinalizedCounts) return lastFinalizedCounts;
    const total = quests.length;
    const estimatedDone = Math.round((lastCompletionPct / 100) * total);
    return { done: Math.max(0, Math.min(total, estimatedDone)), total };
  }, [lastCompletionPct, lastFinalizedCounts, quests.length]);
  const hasDailyRecap = Boolean(lastDrUpdateDate);

  const todayXP = useMemo(() => {
    const baseXP = quests.filter((q) => q.done).reduce((sum, q) => {
      const diffMultiplier = getDifficultyMultiplier(q.difficulty);
      return sum + Math.floor(q.xp * diffMultiplier);
    }, 0);
    return Math.floor(baseXP);
  }, [quests]);

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
  };

  const deleteQuest = (questId: string) => {
    setQuests((prev) => prev.filter((q) => q.id !== questId));
  };

  const editQuest = (
    questId: string,
    title: string,
    categoryId: string,
    xp: number,
    difficulty: "easy" | "medium" | "hard"
  ) => {
    const safeDifficulty = normalizeDifficulty(difficulty);
    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId ? { ...q, title, categoryId, xp, difficulty: safeDifficulty } : q
      )
    );
    setEditingQuestId(null);
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

  const resetDemo = async () => {
    const resetCategories = defaultCategories.map((c) => ({
      ...c,
      level: 0,
      xp: 0,
      xpToNext: 90,
    }));
    setCategories(resetCategories);
    setQuests(defaultQuests);

    // ✅ wipe DR
    setDisciplineRating(defaultDisciplineRating);
    setLastDrDelta(defaultLastDrDelta);
    setLastCompletionPct(defaultLastCompletionPct);
    setLastDrUpdateDate(defaultLastDrUpdateDate);
    setDrHistory(defaultDrHistory);
    setLastFinalizedCounts(null);

    setShowAdd(false);
    setEditingQuestId(null);
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

  const topBandBg = colors.surface;
  const questBandBg = colors.bg;
  const ringThickness = 3;
  const ringRadius = 14;
  const ringMetrics = useMemo(() => {
    if (!todayCardSize) return null;
    const rectWidth = todayCardSize.width;
    const rectHeight = todayCardSize.height;
    const x = ringThickness / 2;
    const y = ringThickness / 2;
    const w = rectWidth;
    const h = rectHeight;
    const r = Math.min(ringRadius, Math.max(0, Math.min(w, h) / 2 - 1));
    const perimeter = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
    const path = [
      `M ${x + w / 2} ${y}`,
      `H ${x + w - r}`,
      `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
      `V ${y + h - r}`,
      `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
      `H ${x + r}`,
      `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
      `V ${y + r}`,
      `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
      `H ${x + w / 2}`,
    ].join(" ");
    return {
      path,
      perimeter,
      svgWidth: rectWidth + ringThickness,
      svgHeight: rectHeight + ringThickness,
      offset: ringThickness / 2,
    };
  }, [todayCardSize]);
  const ringDashoffset = ringMetrics ? ringMetrics.perimeter * (1 - todayProgress) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: "transparent" }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.sectionBand, styles.sectionBandTight, { backgroundColor: topBandBg }]}>
            <Text style={[styles.title, { color: colors.accentPrimary }]}>StatLife</Text>
            <Text style={styles.homeSubtitle}>Daily progress. Built through discipline.</Text>

            <View style={[styles.topRow, { marginBottom: 12 }]}>
              <View
                style={[
                  styles.pill,
                  styles.drPrimaryPill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.pillLabel, styles.drLabelText, { color: colors.textSecondary }]}>Discipline Rating</Text>
                <Text style={[styles.pillValue, styles.drPrimaryValue, { color: colors.accentPrimary }]}>
                  {disciplineRating}
                </Text>
                <Text style={[styles.drRankText, { color: colors.textSecondary }]}>
                  {getRankEmoji(rankName)} {rankName}
                </Text>
                <Text style={[styles.drSupportText, { color: colors.textSecondary }]}>
                  {hasDailyRecap
                    ? `Yesterday: ${recapCounts.done}/${recapCounts.total} (${lastCompletionPct}%) -> DR ${formatDelta(lastDrDelta)}`
                    : "Complete quests to start building DR."}
                </Text>
                <Text style={[styles.drSupportText, { color: colors.textSecondary }]}>
                  {nextRank
                    ? `Next Rank: ${nextRank.name} in ${nextRank.remainingDr} DR`
                    : "Top Rank: Grand Discipline"}
                </Text>
              </View>

              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.pillLabel, styles.secondaryPillLabel, { color: colors.textSecondary }]}>Overall</Text>
                <Text style={[styles.pillValue, styles.secondaryPillValue, { color: colors.accentPrimary }]}>Lv {overall}</Text>
              </View>

              <View
                style={[styles.pill, styles.todayPill]}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  if (!todayCardSize || width !== todayCardSize.width || height !== todayCardSize.height) {
                    setTodayCardSize({ width, height });
                  }
                }}
              >
                {ringMetrics && (
                  <View
                    style={[
                      styles.todayRingWrap,
                      {
                        left: -ringMetrics.offset,
                        top: -ringMetrics.offset,
                        width: ringMetrics.svgWidth,
                        height: ringMetrics.svgHeight,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Svg width={ringMetrics.svgWidth} height={ringMetrics.svgHeight}>
                      <Path
                        d={ringMetrics.path}
                        stroke={`${colors.accentSecondary}33`}
                        strokeWidth={ringThickness}
                        fill="none"
                      />
                      <Path
                        d={ringMetrics.path}
                        stroke={colors.accentPrimary}
                        strokeWidth={ringThickness}
                        strokeLinecap="round"
                        strokeDasharray={ringMetrics.perimeter}
                        strokeDashoffset={ringDashoffset}
                        fill="none"
                      />
                    </Svg>
                  </View>
                )}
                <View style={styles.todayContent}>
                  <View style={styles.todayLabelRow}>
                    <Text style={[styles.pillLabel, styles.secondaryPillLabel, { color: colors.textSecondary }]}>Today</Text>
                    <View style={[styles.todayAccentDot, { backgroundColor: colors.accentPrimary }]} />
                  </View>
                  <View style={styles.todayXPRow}>
                    <Text style={[styles.pillValue, styles.secondaryPillValue, styles.todayValue, { color: colors.accentPrimary }]}>
                      {doneCount}/{quests.length} • +{todayXP} XP
                    </Text>
                  </View>
                </View>
              </View>

            </View>

            <View style={styles.homeActionRow}>
              <Pressable style={styles.homeActionBtn} onPress={resetToday}>
                <Text style={styles.homeActionText}>Reset Today</Text>
              </Pressable>
              <Pressable style={styles.homeActionBtnDanger} onPress={resetDemo}>
                <Text style={styles.homeActionText}>Reset Demo</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.sectionBand, { backgroundColor: questBandBg, marginTop: 12 }]}>
            {/* TODAY'S QUESTS HEADER */}
            <View style={styles.sectionRow}>
              <Text style={[styles.section, { color: colors.textPrimary }]}>Today's Quests</Text>
              <Pressable onPress={() => setShowAdd((s) => !s)}>
                <Text style={[styles.link, { color: colors.accentPrimary }]}>{showAdd ? "Cancel" : "+ Add"}</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionSubtext}>
              Complete what matters most. Pinned quests stay at the top.
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
                    onComplete={completeQuest}
                    onEdit={setEditingQuestId}
                    onPin={togglePin}
                    onDelete={deleteQuest}
                  />
                ))}
            </View>
            <View style={styles.homeHintCard}>
              <Text style={styles.homeHintText}>
                Tip: Check the "Stats" tab for progression and DR history. Visit "Achievements" to track badges.
              </Text>
            </View>
            <Footer />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


