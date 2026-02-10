import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddQuestForm } from "./components/AddQuestForm";
import { EditQuestForm } from "./components/EditQuestForm";
import { Footer } from "./components/Footer";
import { QuestCard } from "./components/QuestCard";
import { createStyles } from "./styles";
import {
    applyDayResult,
    diffDays,
    liveStreak,
    localDateKey,
} from "./utils/dateHelpers";
import { defaultAchievements, defaultCategories, defaultQuests, defaultStreak } from "./utils/defaultData";
import { getStreakMultiplier, levelUp } from "./utils/gameHelpers";
import { useTheme } from "./utils/themeContext";
import type { Achievement, Category, Quest, StoredState, Streak } from "./utils/types";
import { STORAGE_KEY } from "./utils/types";

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

  const [streakAny, setStreakAny] = useState<Streak>(defaultStreak);
  const [streakPerfect, setStreakPerfect] = useState<Streak>(defaultStreak);
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newXP, setNewXP] = useState("10");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");

  // Edit quest state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);

  // LOAD (and apply daily reset if needed + update streaks)
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

        const loadedStreakAny =
          parsed.streakAny && typeof parsed.streakAny.current === "number"
            ? parsed.streakAny
            : defaultStreak;

        const loadedStreakPerfect =
          parsed.streakPerfect && typeof parsed.streakPerfect.current === "number"
            ? parsed.streakPerfect
            : defaultStreak;

        const loadedAchievements = Array.isArray(parsed.achievements)
          ? parsed.achievements
          : defaultAchievements;

        // ✅ If a new day, finalize yesterday's streak result
        const gap = diffDays(savedResetDate, today);

        let nextStreakAny = loadedStreakAny;
        let nextStreakPerfect = loadedStreakPerfect;

        if (gap >= 1) {
          const donePrev = loadedQuests.filter((q) => q.done).length;
          const totalPrev = loadedQuests.length;

          const successAnyPrev = donePrev > 0;
          const successPerfectPrev = totalPrev > 0 && donePrev === totalPrev;

          nextStreakAny = applyDayResult(loadedStreakAny, savedResetDate, successAnyPrev, gap);
          nextStreakPerfect = applyDayResult(
            loadedStreakPerfect,
            savedResetDate,
            successPerfectPrev,
            gap
          );
        }

        // ✅ Daily reset + normalize difficulty
        const finalQuests =
          savedResetDate !== today
            ? loadedQuests.map((q) => ({ ...q, done: false }))
            : loadedQuests;

        const normalizedFinalQuests = finalQuests.map((q) => ({
          ...q,
          difficulty: normalizeDifficulty((q as any).difficulty),
          pinned: Boolean((q as any).pinned),
        }));

        setCategories(loadedCategories);
        setQuests(normalizedFinalQuests);
        setStreakAny(nextStreakAny);
        setStreakPerfect(nextStreakPerfect);
        setAchievements(loadedAchievements);
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
          streakAny,
          streakPerfect,
          achievements,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.log("Failed to save storage:", e);
      }
    })();
  }, [categories, quests, lastResetDate, streakAny, streakPerfect, achievements, hydrated]);

  const overall = useMemo(() => {
    const totalLevel = categories.reduce((sum, c) => sum + c.level, 0);
    const avg = categories.length ? totalLevel / categories.length : 0;
    return Math.round(avg * 10) / 10;
  }, [categories]);

  const todayXP = useMemo(() => {
    const baseXP = quests.filter((q) => q.done).reduce((sum, q) => {
      const diffMultiplier = getDifficultyMultiplier(q.difficulty);
      return sum + Math.floor(q.xp * diffMultiplier);
    }, 0);
    const streakMultiplier = getStreakMultiplier(streakAny.current);
    return Math.floor(baseXP * streakMultiplier);
  }, [quests, streakAny]);

  const doneCount = useMemo(() => quests.filter((q) => q.done).length, [quests]);

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Category";

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

  const normalizeDifficulty = (d: any): "easy" | "medium" | "hard" => {
    if (d === "medium" || d === "hard") return d;
    return "easy";
  };

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

    // streak_7: Achieve 7-day streak
    if (streakAny.current >= 7 && !achievements.find((a) => a.id === "streak_7")?.unlockedAt) {
      unlockAchievement("streak_7");
    }
  };

  const completeQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.done) return;

    // Add haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const difficultyMultiplier = getDifficultyMultiplier(quest.difficulty);
    const streakMultiplier = getStreakMultiplier(streakAny.current);
    const xpAwarded = Math.floor(quest.xp * difficultyMultiplier * streakMultiplier);

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

    // wipe streaks
    setStreakAny(defaultStreak);
    setStreakPerfect(defaultStreak);

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
          streakAny: defaultStreak,
          streakPerfect: defaultStreak,
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

  // ✅ live streak display for TODAY
  const todayKeyStr = localDateKey();
  const todaySuccessAny = doneCount > 0;
  const todaySuccessPerfect = quests.length > 0 && doneCount === quests.length;

  const liveAny = liveStreak(streakAny, todayKeyStr, todaySuccessAny);
  const livePerfect = liveStreak(streakPerfect, todayKeyStr, todaySuccessPerfect);

  const topBandBg = colors.surface;
  const questBandBg = colors.bg;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: "transparent" }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.sectionBand, styles.sectionBandTight, { backgroundColor: topBandBg }]}>
            <Text style={[styles.title, { color: colors.accentPrimary }]}>StatLife</Text>

            <View style={styles.topRow}>
              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Overall</Text>
                <Text style={[styles.pillValue, { color: colors.accentPrimary }]}>Lv {overall}</Text>
              </View>

              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Today</Text>
                <Text style={[styles.pillValue, { color: colors.accentPrimary }]}> 
                  {doneCount}/{quests.length} • +{todayXP} XP
                </Text>
              </View>

              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Streak</Text>
                <Text style={[styles.pillValue, { color: colors.accentPrimary }]}> 
                  {liveAny} day{liveAny === 1 ? "" : "s"} • best {streakAny.best}
                </Text>
              </View>

              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Perfect</Text>
                <Text style={[styles.pillValue, { color: colors.accentPrimary }]}> 
                  {livePerfect} day{livePerfect === 1 ? "" : "s"} • best {streakPerfect.best}
                </Text>
              </View>

              {streakAny.current >= 3 && (
                <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                  <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Streak Bonus</Text>
                  <Text style={[styles.pillValue, { color: colors.accentPrimary }]}> 
                    +{Math.round((getStreakMultiplier(streakAny.current) - 1) * 100)}% XP
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <Pressable style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={resetToday}>
                <Text style={[styles.btnText, { color: colors.textPrimary }]}>Reset Today</Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={resetDemo}>
                <Text style={[styles.btnText, { color: colors.textPrimary }]}>Reset Demo</Text>
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

            <Text style={styles.hint}>
              💡 Check the "Stats" tab for category progression. Visit "Achievements" to track your badges!
            </Text>
            <Footer />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
