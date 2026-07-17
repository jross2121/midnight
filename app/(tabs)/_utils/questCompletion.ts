import { getAchievementsAfterQuestCompletion } from "./achievements";
import { levelUp } from "./gameHelpers";
import { getQuestXpForDifficulty } from "./questXp";
import type { StoredState } from "./types";

export type QuestCompletionResult = {
  state: StoredState;
  completed: boolean;
};

export function completeQuestInStoredState(
  state: StoredState,
  questId: string,
  dateKey: string
): QuestCompletionResult {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || quest.done) return { state, completed: false };

  const quests = state.quests.map((item) =>
    item.id === questId ? { ...item, done: true } : item
  );
  const previousCategories = state.categories;
  const categories = state.categories.map((category) =>
    category.id === quest.categoryId
      ? levelUp({
          ...category,
          xp: category.xp + getQuestXpForDifficulty(quest.difficulty),
        })
      : category
  );
  const lifetimeCompletedQuestCount = state.lifetimeCompletedQuestCount + 1;
  const achievements = getAchievementsAfterQuestCompletion({
    achievements: state.achievements,
    quests,
    categories,
    previousCategories,
    lifetimeCompletedQuestCount,
    dateKey,
  });

  return {
    completed: true,
    state: {
      ...state,
      quests,
      categories,
      achievements,
      lifetimeCompletedQuestCount,
    },
  };
}
