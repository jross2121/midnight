import type { Achievement, Category, DrHistoryEntry, Quest, QuestTemplate } from "./types";
import { getQuestXpForDifficulty } from "./questXp";

export const defaultCategories: Category[] = [
  { id: "health", name: "Health", level: 3, xp: 40, xpToNext: 120 },
  { id: "money", name: "Money", level: 2, xp: 75, xpToNext: 110 },
  { id: "career", name: "Career", level: 4, xp: 10, xpToNext: 140 },
  { id: "social", name: "Social", level: 1, xp: 25, xpToNext: 90 },
  { id: "home", name: "Home", level: 2, xp: 15, xpToNext: 110 },
  { id: "fun", name: "Personal", level: 5, xp: 60, xpToNext: 160 },
];

export const defaultQuests: Quest[] = [
  { id: "q1", title: "Workout (20 min)", categoryId: "health", xp: getQuestXpForDifficulty("medium"), target: "20 min", difficulty: "medium", repeat: "daily", done: false, pinned: false, contract: true },
  { id: "q2", title: "Drink water (8 cups)", categoryId: "health", xp: getQuestXpForDifficulty("easy"), target: "8 cups", difficulty: "easy", repeat: "daily", done: false, pinned: false },
  { id: "q3", title: "No impulse buys today", categoryId: "money", xp: getQuestXpForDifficulty("easy"), target: "$0", difficulty: "easy", repeat: "daily", done: false, pinned: false },
  { id: "q4", title: "Apply to 1 job", categoryId: "career", xp: getQuestXpForDifficulty("hard"), target: "1", difficulty: "hard", repeat: "weekdays", done: false, pinned: false, contract: true },
  { id: "q5", title: "Clean for 10 minutes", categoryId: "home", xp: getQuestXpForDifficulty("easy"), target: "10 min", difficulty: "easy", repeat: "daily", done: false, pinned: false },
  { id: "q6", title: "Text/call someone you care about", categoryId: "social", xp: getQuestXpForDifficulty("medium"), target: "1 person", difficulty: "medium", repeat: "daily", done: false, pinned: false },
  { id: "q7", title: "Relax guilt-free (30 min)", categoryId: "fun", xp: getQuestXpForDifficulty("easy"), target: "30 min", difficulty: "easy", repeat: "daily", done: false, pinned: false },
];

export const questTemplates: QuestTemplate[] = [
  { id: "first_win", title: "First win before noon", categoryId: "health", xp: getQuestXpForDifficulty("easy"), target: "1 small action", difficulty: "easy", repeat: "once" },
  { id: "walk_20", title: "Walk outside (20 min)", categoryId: "health", xp: getQuestXpForDifficulty("medium"), target: "20 min", difficulty: "medium" },
  { id: "budget_check", title: "Check budget for 5 minutes", categoryId: "money", xp: getQuestXpForDifficulty("easy"), target: "5 min", difficulty: "easy" },
  { id: "career_push", title: "One career push", categoryId: "career", xp: getQuestXpForDifficulty("hard"), target: "1 action", difficulty: "hard", contract: true },
  { id: "reset_room", title: "Reset one room", categoryId: "home", xp: getQuestXpForDifficulty("easy"), target: "10 min", difficulty: "easy" },
  { id: "message_someone", title: "Message someone you care about", categoryId: "social", xp: getQuestXpForDifficulty("medium"), target: "1 person", difficulty: "medium" },
  { id: "real_rest", title: "Guilt-free rest", categoryId: "fun", xp: getQuestXpForDifficulty("easy"), target: "30 min", difficulty: "easy" },
  { id: "deep_work", title: "Deep work block", categoryId: "career", xp: getQuestXpForDifficulty("hard"), target: "45 min", difficulty: "hard" },
  { id: "protein_anchor", title: "Protein anchor meal", categoryId: "health", xp: getQuestXpForDifficulty("easy"), target: "1 meal", difficulty: "easy" },
  { id: "stretch_10", title: "Stretch for 10 minutes", categoryId: "health", xp: getQuestXpForDifficulty("easy"), target: "10 min", difficulty: "easy" },
  { id: "sleep_setup", title: "Set up sleep on time", categoryId: "health", xp: getQuestXpForDifficulty("medium"), target: "1 routine", difficulty: "medium", contract: true },
  { id: "money_move", title: "Move money with intent", categoryId: "money", xp: getQuestXpForDifficulty("medium"), target: "1 transfer", difficulty: "medium" },
  { id: "cancel_leak", title: "Cancel one money leak", categoryId: "money", xp: getQuestXpForDifficulty("medium"), target: "1 subscription", difficulty: "medium" },
  { id: "receipt_sweep", title: "Log recent spending", categoryId: "money", xp: getQuestXpForDifficulty("easy"), target: "5 entries", difficulty: "easy" },
  { id: "inbox_zero_10", title: "Inbox sweep", categoryId: "career", xp: getQuestXpForDifficulty("easy"), target: "10 min", difficulty: "easy" },
  { id: "ship_small", title: "Ship one small thing", categoryId: "career", xp: getQuestXpForDifficulty("hard"), target: "1 deliverable", difficulty: "hard", contract: true },
  { id: "learn_rep", title: "One learning rep", categoryId: "career", xp: getQuestXpForDifficulty("medium"), target: "20 min", difficulty: "medium" },
  { id: "laundry_flip", title: "Start or flip laundry", categoryId: "home", xp: getQuestXpForDifficulty("easy"), target: "1 load", difficulty: "easy" },
  { id: "counter_clear", title: "Clear one surface", categoryId: "home", xp: getQuestXpForDifficulty("easy"), target: "1 surface", difficulty: "easy" },
  { id: "trash_reset", title: "Take out trash reset", categoryId: "home", xp: getQuestXpForDifficulty("easy"), target: "1 bag", difficulty: "easy" },
  { id: "friend_ping", title: "Send a thoughtful check-in", categoryId: "social", xp: getQuestXpForDifficulty("easy"), target: "1 message", difficulty: "easy" },
  { id: "plan_invite", title: "Make one real plan", categoryId: "social", xp: getQuestXpForDifficulty("medium"), target: "1 invite", difficulty: "medium" },
  { id: "family_touchpoint", title: "Family touchpoint", categoryId: "social", xp: getQuestXpForDifficulty("medium"), target: "1 call/text", difficulty: "medium" },
  { id: "creative_sprint", title: "Creative sprint", categoryId: "fun", xp: getQuestXpForDifficulty("medium"), target: "20 min", difficulty: "medium" },
  { id: "no_scroll_window", title: "No-scroll window", categoryId: "fun", xp: getQuestXpForDifficulty("medium"), target: "45 min", difficulty: "medium" },
  { id: "tiny_adventure", title: "Tiny adventure", categoryId: "fun", xp: getQuestXpForDifficulty("medium"), target: "1 outing", difficulty: "medium" },
];

export const defaultAchievements: Achievement[] = [
  { id: "first_quest", name: "First Step", description: "Complete your first quest", icon: "Q1", unlockedAt: null },
  { id: "quest_10", name: "Ten Count", description: "Complete 10 quests total", icon: "Q10", unlockedAt: null },
  { id: "30_quests", name: "Quest Master", description: "Complete 30 quests total", icon: "Q30", unlockedAt: null },
  { id: "quest_100", name: "Century Run", description: "Complete 100 quests total", icon: "Q100", unlockedAt: null },
  { id: "hard_mode", name: "Challenge Accepted", description: "Complete a hard difficulty quest", icon: "H1", unlockedAt: null },
  { id: "double_hard", name: "Heavy Lift", description: "Complete 2 hard quests in one day", icon: "H2", unlockedAt: null },
  { id: "100_xp", name: "Century", description: "Earn 100 XP in a single day", icon: "XP1", unlockedAt: null },
  { id: "xp_150", name: "Power Day", description: "Earn 150 XP in a single day", icon: "XP2", unlockedAt: null },
  { id: "xp_200", name: "Overdrive", description: "Earn 200 XP in a single day", icon: "XP3", unlockedAt: null },
  { id: "perfect_day", name: "Perfectionist", description: "Complete all quests in one day", icon: "P1", unlockedAt: null },
  { id: "perfect_3", name: "Clean Sweep", description: "Record 3 perfect judgment days", icon: "P3", unlockedAt: null },
  { id: "balanced_day", name: "Balanced Run", description: "Complete quests in 4 categories in one day", icon: "B4", unlockedAt: null },
  { id: "level_5", name: "Climbing", description: "Reach level 5 in any category", icon: "L5", unlockedAt: null },
  { id: "level_10", name: "Specialist", description: "Reach level 10 in any category", icon: "L10", unlockedAt: null },
  { id: "all_categories", name: "Balanced Life", description: "Reach level 3 in all categories", icon: "A3", unlockedAt: null },
  { id: "all_categories_5", name: "Full Spectrum", description: "Reach level 5 in all categories", icon: "A5", unlockedAt: null },
  { id: "first_contract", name: "Oathkeeper", description: "Protect every contract quest in a day", icon: "C1", unlockedAt: null },
  { id: "contract_3", name: "Pledge Streak", description: "Protect contracts 3 judgment days in a row", icon: "C3", unlockedAt: null },
  { id: "contract_7", name: "Iron Oath", description: "Protect contracts 7 judgment days in a row", icon: "C7", unlockedAt: null },
  { id: "contract_14", name: "Unbroken Oath", description: "Protect contracts 14 judgment days in a row", icon: "C14", unlockedAt: null },
  { id: "three_solid_days", name: "Stable Signal", description: "Record 3 solid judgment days in a row", icon: "S3", unlockedAt: null },
  { id: "solid_7", name: "Weekly Signal", description: "Record 7 solid judgment days in a row", icon: "S7", unlockedAt: null },
  { id: "solid_14", name: "Discipline Engine", description: "Record 14 solid judgment days in a row", icon: "S14", unlockedAt: null },
  { id: "comeback_day", name: "Recovery Arc", description: "Earn a comeback bonus at midnight", icon: "R+", unlockedAt: null },
  { id: "rank_climber", name: "Rank Climber", description: "Reach Consistent rank or higher", icon: "R2", unlockedAt: null },
  { id: "rank_focused", name: "Focused Climb", description: "Reach Focused rank or higher", icon: "R3", unlockedAt: null },
  { id: "rank_driven", name: "Driven Signal", description: "Reach Driven rank or higher", icon: "R4", unlockedAt: null },
  { id: "rank_relentless", name: "Relentless", description: "Reach Relentless rank or higher", icon: "R5", unlockedAt: null },
  { id: "rank_elite", name: "Elite Discipline", description: "Reach Elite rank or higher", icon: "R6", unlockedAt: null },
  { id: "rank_grand", name: "Grand Discipline", description: "Reach Grand Discipline rank", icon: "R7", unlockedAt: null },
];

export const defaultDisciplineRating = 0;
export const defaultLastDrDelta = 0;
export const defaultLastCompletionPct = 0;
export const defaultLastDrUpdateDate = "";
export const defaultDrHistory: DrHistoryEntry[] = [];
