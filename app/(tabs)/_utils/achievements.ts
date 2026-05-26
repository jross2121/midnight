import { localDateKey } from "./dateHelpers";
import { defaultAchievements } from "./defaultData";
import { getScheduledQuestsForDate } from "./recurrence";
import type { Achievement, Category, Quest } from "./types";

type StoredAchievementSnapshot = Pick<Achievement, "id"> & Partial<Pick<Achievement, "unlockedAt">>;

type CompletionAchievementArgs = {
  achievements: Achievement[];
  quests: Quest[];
  categories: Category[];
  previousCategories: Category[];
  lifetimeCompletedQuestCount: number;
  dateKey?: string;
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
  previousCategories,
  lifetimeCompletedQuestCount,
  dateKey = localDateKey(),
}: CompletionAchievementArgs): Achievement[] {
  const todaysQuests = getScheduledQuestsForDate(quests, dateKey);
  const completedToday = todaysQuests.filter((quest) => quest.done);
  const todayXPTotal = completedToday.reduce((sum, quest) => sum + quest.xp, 0);
  const hardQuestDoneCount = completedToday.filter((quest) => quest.difficulty === "hard").length;
  const completedCategoryCount = new Set(completedToday.map((quest) => quest.categoryId)).size;
  const contractQuests = todaysQuests.filter((quest) => quest.contract);
  const unlockedAt = new Date().toISOString();

  let nextAchievements = achievements;
  const unlock = (id: string) => {
    nextAchievements = unlockAchievementById(nextAchievements, id, unlockedAt);
  };

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

  if (
    categories.some((category) => {
      const previousLevel = previousCategories.find((item) => item.id === category.id)?.level ?? category.level;
      return previousLevel < 5 && category.level >= 5;
    })
  ) {
    unlock("level_5");
  }
  if (categories.some((category) => category.level >= 10)) unlock("level_10");
  if (categories.length > 0 && categories.every((category) => category.level >= 3)) unlock("all_categories");
  if (categories.length > 0 && categories.every((category) => category.level >= 5)) unlock("all_categories_5");

  return nextAchievements;
}
