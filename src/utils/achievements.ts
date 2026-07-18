import { localDateKey } from "./dateHelpers";
import { defaultAchievements } from "./defaultData";
import type { MidnightEvaluationData } from "./midnightEvaluation";
import { buildStreakSummary } from "./planning";
import { getScheduledQuestsForDate } from "./recurrence";
import { getRankFromDR, getRankMeta } from "./rank";
import type { Achievement, Category, DrHistoryEntry, Quest } from "./types";

type StoredAchievementSnapshot = Pick<Achievement, "id"> & Partial<Pick<Achievement, "unlockedAt">>;

type CompletionAchievementArgs = {
  achievements: Achievement[];
  quests: Quest[];
  categories: Category[];
  previousCategories: Category[];
  lifetimeCompletedQuestCount: number;
  dateKey?: string;
};

type CompletionAchievementEligibilityArgs = Omit<
  CompletionAchievementArgs,
  "achievements" | "previousCategories"
>;

export const QUEST_COMPLETION_ACHIEVEMENT_IDS = [
  "first_quest",
  "quest_10",
  "30_quests",
  "quest_50",
  "quest_100",
  "hard_mode",
  "double_hard",
  "100_xp",
  "xp_150",
  "xp_200",
  "balanced_day",
  "perfect_day",
  "first_contract",
  "level_5",
  "level_10",
  "all_categories",
  "all_categories_5",
] as const;

type EvaluationAchievementArgs = {
  achievements: Achievement[];
  drHistory: DrHistoryEntry[];
  disciplineRating: number;
  evaluation: MidnightEvaluationData;
  unlockedAt?: string;
};

export function isAchievement(value: unknown): value is StoredAchievementSnapshot {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<Achievement>;
  return (
    typeof candidate.id === "string" &&
    (typeof candidate.unlockedAt === "undefined" ||
      typeof candidate.unlockedAt === "string" ||
      candidate.unlockedAt === null)
  );
}

export function mergeAchievements(saved: unknown): Achievement[] {
  if (!Array.isArray(saved)) return defaultAchievements;

  const savedById = new Map(
    saved.filter(isAchievement).map((achievement) => [
      achievement.id,
      typeof achievement.unlockedAt === "string" ? achievement.unlockedAt : null,
    ])
  );

  return defaultAchievements.map((achievement) => ({
    ...achievement,
    unlockedAt: savedById.get(achievement.id) ?? achievement.unlockedAt,
  }));
}

export function unlockAchievementById(
  achievements: Achievement[],
  achievementId: string,
  unlockedAt = new Date().toISOString()
): Achievement[] {
  return achievements.map((achievement) =>
    achievement.id === achievementId && !achievement.unlockedAt
      ? { ...achievement, unlockedAt }
      : achievement
  );
}

export function getAchievementsAfterQuestCompletion({
  achievements,
  quests,
  categories,
  lifetimeCompletedQuestCount,
  dateKey = localDateKey(),
}: CompletionAchievementArgs): Achievement[] {
  const eligibleIds = getEligibleQuestCompletionAchievementIds({
    quests,
    categories,
    lifetimeCompletedQuestCount,
    dateKey,
  });
  const unlockedAt = new Date().toISOString();
  let nextAchievements = achievements;

  for (const id of eligibleIds) {
    nextAchievements = unlockAchievementById(nextAchievements, id, unlockedAt);
  }

  return nextAchievements;
}

export function getEligibleQuestCompletionAchievementIds({
  quests,
  categories,
  lifetimeCompletedQuestCount,
  dateKey = localDateKey(),
}: CompletionAchievementEligibilityArgs): Set<string> {
  const todaysQuests = getScheduledQuestsForDate(quests, dateKey);
  const completedToday = todaysQuests.filter((quest) => quest.done);
  const todayXPTotal = completedToday.reduce((sum, quest) => sum + quest.xp, 0);
  const hardQuestDoneCount = completedToday.filter((quest) => quest.difficulty === "hard").length;
  const completedCategoryCount = new Set(completedToday.map((quest) => quest.categoryId)).size;
  const contractQuests = todaysQuests.filter((quest) => quest.contract);
  const eligibleIds = new Set<string>();
  const unlock = (id: string) => eligibleIds.add(id);

  if (lifetimeCompletedQuestCount >= 1) unlock("first_quest");
  if (lifetimeCompletedQuestCount >= 10) unlock("quest_10");
  if (lifetimeCompletedQuestCount >= 30) unlock("30_quests");
  if (lifetimeCompletedQuestCount >= 50) unlock("quest_50");
  if (lifetimeCompletedQuestCount >= 100) unlock("quest_100");
  if (completedToday.some((quest) => quest.difficulty === "hard")) unlock("hard_mode");
  if (hardQuestDoneCount >= 2) unlock("double_hard");
  if (todayXPTotal >= 100) unlock("100_xp");
  if (todayXPTotal >= 150) unlock("xp_150");
  if (todayXPTotal >= 200) unlock("xp_200");
  if (completedCategoryCount >= 4) unlock("balanced_day");
  if (todaysQuests.length > 0 && todaysQuests.every((quest) => quest.done)) unlock("perfect_day");
  if (contractQuests.length > 0 && contractQuests.every((quest) => quest.done)) unlock("first_contract");

  if (categories.some((category) => category.level >= 5)) unlock("level_5");
  if (categories.some((category) => category.level >= 10)) unlock("level_10");
  if (categories.length > 0 && categories.every((category) => category.level >= 3)) unlock("all_categories");
  if (categories.length > 0 && categories.every((category) => category.level >= 5)) unlock("all_categories_5");

  return eligibleIds;
}

export function getAchievementsAfterMidnightEvaluation({
  achievements,
  drHistory,
  disciplineRating,
  evaluation,
  unlockedAt = new Date().toISOString(),
}: EvaluationAchievementArgs): Achievement[] {
  if (evaluation.recoveryDay) return achievements;

  const streakSummary = buildStreakSummary(drHistory);
  const rankTier = getRankMeta(getRankFromDR(disciplineRating)).tier;
  let nextAchievements = achievements;
  const unlock = (id: string) => {
    nextAchievements = unlockAchievementById(nextAchievements, id, unlockedAt);
  };

  if (streakSummary.solidDayStreak >= 3) unlock("three_solid_days");
  if (streakSummary.solidDayStreak >= 7) unlock("solid_7");
  if (streakSummary.solidDayStreak >= 14) unlock("solid_14");
  if (streakSummary.solidDayStreak >= 21) unlock("solid_21");
  if (streakSummary.contractStreak >= 3) unlock("contract_3");
  if (streakSummary.contractStreak >= 7) unlock("contract_7");
  if (streakSummary.contractStreak >= 14) unlock("contract_14");
  if (streakSummary.contractStreak >= 21) unlock("contract_21");
  if (drHistory.filter((entry) => !entry.recoveryDay && entry.pct >= 100).length >= 3) unlock("perfect_3");
  if (evaluation.comebackBonus > 0) unlock("comeback_day");
  if (rankTier >= 2) unlock("rank_climber");
  if (rankTier >= 3) unlock("rank_focused");
  if (rankTier >= 4) unlock("rank_driven");
  if (rankTier >= 5) unlock("rank_relentless");
  if (rankTier >= 6) unlock("rank_elite");
  if (rankTier >= 7) unlock("rank_grand");

  return nextAchievements;
}
