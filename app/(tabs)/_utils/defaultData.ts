import type { Achievement, Category, DrHistoryEntry, Quest } from "./types";

export const defaultCategories: Category[] = [
  { id: "health", name: "Health", level: 3, xp: 40, xpToNext: 120 },
  { id: "money", name: "Money", level: 2, xp: 75, xpToNext: 110 },
  { id: "career", name: "Career", level: 4, xp: 10, xpToNext: 140 },
  { id: "social", name: "Social", level: 1, xp: 25, xpToNext: 90 },
  { id: "home", name: "Home", level: 2, xp: 15, xpToNext: 110 },
  { id: "fun", name: "Fun", level: 5, xp: 60, xpToNext: 160 },
];

export const defaultQuests: Quest[] = [
  { id: "q1", title: "Workout (20 min)", categoryId: "health", xp: 25, target: "20 min", difficulty: "medium", done: false, pinned: false },
  { id: "q2", title: "Drink water (8 cups)", categoryId: "health", xp: 10, target: "8 cups", difficulty: "easy", done: false, pinned: false },
  { id: "q3", title: "No impulse buys today", categoryId: "money", xp: 20, target: "$0", difficulty: "easy", done: false, pinned: false },
  { id: "q4", title: "Apply to 1 job", categoryId: "career", xp: 30, target: "1", difficulty: "hard", done: false, pinned: false },
  { id: "q5", title: "Clean for 10 minutes", categoryId: "home", xp: 15, target: "10 min", difficulty: "easy", done: false, pinned: false },
  { id: "q6", title: "Text/call someone you care about", categoryId: "social", xp: 15, target: "1 person", difficulty: "medium", done: false, pinned: false },
  { id: "q7", title: "Relax guilt-free (30 min)", categoryId: "fun", xp: 10, target: "30 min", difficulty: "easy", done: false, pinned: false },
];

export const defaultAchievements: Achievement[] = [
  { id: "first_quest", name: "First Step", description: "Complete your first quest", icon: "I", unlockedAt: null },
  { id: "level_5", name: "Climbing", description: "Reach level 5 in any category", icon: "II", unlockedAt: null },
  { id: "hard_mode", name: "Challenge Accepted", description: "Complete a hard difficulty quest", icon: "III", unlockedAt: null },
  { id: "100_xp", name: "Century", description: "Earn 100 XP in a single day", icon: "IV", unlockedAt: null },
  { id: "all_categories", name: "Balanced Life", description: "Reach level 3 in all categories", icon: "V", unlockedAt: null },
  { id: "perfect_day", name: "Perfectionist", description: "Complete all quests in one day", icon: "VI", unlockedAt: null },
  { id: "30_quests", name: "Quest Master", description: "Complete 30 quests total", icon: "VII", unlockedAt: null },
];

export const defaultDisciplineRating = 0;
export const defaultLastDrDelta = 0;
export const defaultLastCompletionPct = 0;
export const defaultLastDrUpdateDate = "";
export const defaultDrHistory: DrHistoryEntry[] = [];
