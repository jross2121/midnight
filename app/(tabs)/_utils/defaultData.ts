import type { Achievement, Category, DrHistoryEntry, Quest, QuestTemplate } from "./types";

export const defaultCategories: Category[] = [
  { id: "health", name: "Health", level: 3, xp: 40, xpToNext: 120 },
  { id: "money", name: "Money", level: 2, xp: 75, xpToNext: 110 },
  { id: "career", name: "Career", level: 4, xp: 10, xpToNext: 140 },
  { id: "social", name: "Social", level: 1, xp: 25, xpToNext: 90 },
  { id: "home", name: "Home", level: 2, xp: 15, xpToNext: 110 },
  { id: "fun", name: "Personal", level: 5, xp: 60, xpToNext: 160 },
];

export const defaultQuests: Quest[] = [
  { id: "q1", title: "Workout (20 min)", categoryId: "health", xp: 25, target: "20 min", difficulty: "medium", done: false, pinned: false, contract: true },
  { id: "q2", title: "Drink water (8 cups)", categoryId: "health", xp: 10, target: "8 cups", difficulty: "easy", done: false, pinned: false },
  { id: "q3", title: "No impulse buys today", categoryId: "money", xp: 20, target: "$0", difficulty: "easy", done: false, pinned: false },
  { id: "q4", title: "Apply to 1 job", categoryId: "career", xp: 30, target: "1", difficulty: "hard", done: false, pinned: false, contract: true },
  { id: "q5", title: "Clean for 10 minutes", categoryId: "home", xp: 15, target: "10 min", difficulty: "easy", done: false, pinned: false },
  { id: "q6", title: "Text/call someone you care about", categoryId: "social", xp: 15, target: "1 person", difficulty: "medium", done: false, pinned: false },
  { id: "q7", title: "Relax guilt-free (30 min)", categoryId: "fun", xp: 10, target: "30 min", difficulty: "easy", done: false, pinned: false },
];

export const questTemplates: QuestTemplate[] = [
  { id: "first_win", title: "First win before noon", categoryId: "health", xp: 10, target: "1 small action", difficulty: "easy" },
  { id: "walk_20", title: "Walk outside (20 min)", categoryId: "health", xp: 20, target: "20 min", difficulty: "medium" },
  { id: "budget_check", title: "Check budget for 5 minutes", categoryId: "money", xp: 15, target: "5 min", difficulty: "easy" },
  { id: "career_push", title: "One career push", categoryId: "career", xp: 30, target: "1 action", difficulty: "hard", contract: true },
  { id: "reset_room", title: "Reset one room", categoryId: "home", xp: 15, target: "10 min", difficulty: "easy" },
  { id: "message_someone", title: "Message someone you care about", categoryId: "social", xp: 15, target: "1 person", difficulty: "medium" },
  { id: "real_rest", title: "Guilt-free rest", categoryId: "fun", xp: 10, target: "30 min", difficulty: "easy" },
  { id: "deep_work", title: "Deep work block", categoryId: "career", xp: 35, target: "45 min", difficulty: "hard" },
  { id: "protein_anchor", title: "Protein anchor meal", categoryId: "health", xp: 15, target: "1 meal", difficulty: "easy" },
  { id: "stretch_10", title: "Stretch for 10 minutes", categoryId: "health", xp: 10, target: "10 min", difficulty: "easy" },
  { id: "sleep_setup", title: "Set up sleep on time", categoryId: "health", xp: 20, target: "1 routine", difficulty: "medium", contract: true },
  { id: "money_move", title: "Move money with intent", categoryId: "money", xp: 20, target: "1 transfer", difficulty: "medium" },
  { id: "cancel_leak", title: "Cancel one money leak", categoryId: "money", xp: 25, target: "1 subscription", difficulty: "medium" },
  { id: "receipt_sweep", title: "Log recent spending", categoryId: "money", xp: 15, target: "5 entries", difficulty: "easy" },
  { id: "inbox_zero_10", title: "Inbox sweep", categoryId: "career", xp: 15, target: "10 min", difficulty: "easy" },
  { id: "ship_small", title: "Ship one small thing", categoryId: "career", xp: 30, target: "1 deliverable", difficulty: "hard", contract: true },
  { id: "learn_rep", title: "One learning rep", categoryId: "career", xp: 20, target: "20 min", difficulty: "medium" },
  { id: "laundry_flip", title: "Start or flip laundry", categoryId: "home", xp: 10, target: "1 load", difficulty: "easy" },
  { id: "counter_clear", title: "Clear one surface", categoryId: "home", xp: 10, target: "1 surface", difficulty: "easy" },
  { id: "trash_reset", title: "Take out trash reset", categoryId: "home", xp: 15, target: "1 bag", difficulty: "easy" },
  { id: "friend_ping", title: "Send a thoughtful check-in", categoryId: "social", xp: 15, target: "1 message", difficulty: "easy" },
  { id: "plan_invite", title: "Make one real plan", categoryId: "social", xp: 25, target: "1 invite", difficulty: "medium" },
  { id: "family_touchpoint", title: "Family touchpoint", categoryId: "social", xp: 20, target: "1 call/text", difficulty: "medium" },
  { id: "creative_sprint", title: "Creative sprint", categoryId: "fun", xp: 20, target: "20 min", difficulty: "medium" },
  { id: "no_scroll_window", title: "No-scroll window", categoryId: "fun", xp: 20, target: "45 min", difficulty: "medium" },
  { id: "tiny_adventure", title: "Tiny adventure", categoryId: "fun", xp: 25, target: "1 outing", difficulty: "medium" },
];

export const defaultAchievements: Achievement[] = [
  { id: "first_quest", name: "First Step", description: "Complete your first quest", icon: "I", unlockedAt: null },
  { id: "level_5", name: "Climbing", description: "Reach level 5 in any category", icon: "II", unlockedAt: null },
  { id: "hard_mode", name: "Challenge Accepted", description: "Complete a hard difficulty quest", icon: "III", unlockedAt: null },
  { id: "100_xp", name: "Century", description: "Earn 100 XP in a single day", icon: "IV", unlockedAt: null },
  { id: "all_categories", name: "Balanced Life", description: "Reach level 3 in all categories", icon: "V", unlockedAt: null },
  { id: "perfect_day", name: "Perfectionist", description: "Complete all quests in one day", icon: "VI", unlockedAt: null },
  { id: "30_quests", name: "Quest Master", description: "Complete 30 quests total", icon: "VII", unlockedAt: null },
  { id: "first_contract", name: "Oathkeeper", description: "Protect every contract quest in a day", icon: "VIII", unlockedAt: null },
  { id: "three_solid_days", name: "Stable Signal", description: "Record 3 solid judgment days in a row", icon: "IX", unlockedAt: null },
  { id: "comeback_day", name: "Recovery Arc", description: "Earn a comeback bonus at midnight", icon: "X", unlockedAt: null },
  { id: "rank_climber", name: "Rank Climber", description: "Reach Apprentice rank or higher", icon: "XI", unlockedAt: null },
];

export const defaultDisciplineRating = 0;
export const defaultLastDrDelta = 0;
export const defaultLastCompletionPct = 0;
export const defaultLastDrUpdateDate = "";
export const defaultDrHistory: DrHistoryEntry[] = [];
