import {
  getAchievementsAfterQuestCompletion,
  getEligibleQuestCompletionAchievementIds,
} from "./achievements";
import { levelUp } from "./gameHelpers";
import { getQuestXpForDifficulty } from "./questXp";
import type { Category, Quest, QuestCompletionReceipt, StoredState } from "./types";

export type QuestCompletionResult = {
  state: StoredState;
  completed: boolean;
};

export type QuestUncompletionResult = {
  state: StoredState;
  uncompleted: boolean;
  rewardsReversed: boolean;
};

function applyReceipt(category: Category, receipt: QuestCompletionReceipt): Category {
  return levelUp({ ...category, xp: category.xp + receipt.awardedXp });
}

export function completeQuestInStoredState(
  state: StoredState,
  questId: string,
  dateKey: string
): QuestCompletionResult {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || quest.done) return { state, completed: false };

  const quests = state.quests.map((item) =>
    item.id === questId ? { ...item, done: true, pinned: false } : item
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
  const recoveryDay = state.recoveryDays?.includes(dateKey) ?? false;
  const achievements = recoveryDay
    ? state.achievements
    : getAchievementsAfterQuestCompletion({
        achievements: state.achievements,
        quests,
        categories,
        previousCategories,
        lifetimeCompletedQuestCount,
        dateKey,
      });
  const unlockedAchievementIds = achievements
    .filter((achievement) => {
      const previous = state.achievements.find((item) => item.id === achievement.id);
      return Boolean(achievement.unlockedAt && !previous?.unlockedAt);
    })
    .map((achievement) => achievement.id);
  const categoryBefore = previousCategories.find((category) => category.id === quest.categoryId);
  const questsWithReceipt = quests.map((item) =>
    item.id === questId && categoryBefore
      ? {
          ...item,
          completionReceipt: {
            dateKey,
            completedAt: new Date().toISOString(),
            awardedXp: getQuestXpForDifficulty(quest.difficulty),
            categoryBefore: { ...categoryBefore },
            unlockedAchievementIds,
          },
        }
      : item
  );

  return {
    completed: true,
    state: {
      ...state,
      quests: questsWithReceipt,
      categories,
      achievements,
      lifetimeCompletedQuestCount,
    },
  };
}

export function uncompleteQuestInStoredState(
  state: StoredState,
  questId: string,
  dateKey: string
): QuestUncompletionResult {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest?.done) return { state, uncompleted: false, rewardsReversed: false };

  const receipt = quest.completionReceipt;
  let quests = state.quests.map((item) =>
    item.id === questId ? { ...item, done: false, completionReceipt: undefined } : item
  );

  // Older backups did not record enough information to safely subtract rewards.
  // They can still be reopened without risking corruption of category progression.
  if (!receipt || receipt.dateKey !== dateKey) {
    return {
      state: { ...state, quests },
      uncompleted: true,
      rewardsReversed: false,
    };
  }

  const categoryReceipts = state.quests
    .filter(
      (item): item is Quest & { completionReceipt: QuestCompletionReceipt } =>
        Boolean(
          item.completionReceipt &&
            item.completionReceipt.dateKey === dateKey &&
            item.categoryId === quest.categoryId
        )
    )
    .sort((a, b) => a.completionReceipt.completedAt.localeCompare(b.completionReceipt.completedAt));
  let rebuiltCategory = categoryReceipts[0]?.completionReceipt.categoryBefore
    ? { ...categoryReceipts[0].completionReceipt.categoryBefore }
    : undefined;

  if (rebuiltCategory) {
    for (const item of categoryReceipts) {
      if (item.id === questId) continue;
      const nextReceipt: QuestCompletionReceipt = {
        ...item.completionReceipt,
        categoryBefore: { ...rebuiltCategory },
      };
      rebuiltCategory = applyReceipt(rebuiltCategory, nextReceipt);
      quests = quests.map((candidate) =>
        candidate.id === item.id ? { ...candidate, completionReceipt: nextReceipt } : candidate
      );
    }
  }

  const categories = rebuiltCategory
    ? state.categories.map((category) =>
        category.id === rebuiltCategory!.id ? rebuiltCategory! : category
      )
    : state.categories;
  const lifetimeCompletedQuestCount = Math.max(0, state.lifetimeCompletedQuestCount - 1);
  const eligibleAchievementIds = getEligibleQuestCompletionAchievementIds({
    quests,
    categories,
    lifetimeCompletedQuestCount,
    dateKey,
  });
  const unlockedByThisCompletion = new Set(receipt.unlockedAchievementIds);
  const transferableAchievementIds = receipt.unlockedAchievementIds.filter((id) =>
    eligibleAchievementIds.has(id)
  );
  const receiptRecipient = quests
    .filter(
      (item): item is Quest & { completionReceipt: QuestCompletionReceipt } =>
        Boolean(item.done && item.completionReceipt?.dateKey === dateKey)
    )
    .sort((a, b) => a.completionReceipt.completedAt.localeCompare(b.completionReceipt.completedAt))[0];

  if (receiptRecipient && transferableAchievementIds.length > 0) {
    const transferredIds = Array.from(
      new Set([
        ...receiptRecipient.completionReceipt.unlockedAchievementIds,
        ...transferableAchievementIds,
      ])
    );
    quests = quests.map((item) =>
      item.id === receiptRecipient.id
        ? {
            ...item,
            completionReceipt: {
              ...receiptRecipient.completionReceipt,
              unlockedAchievementIds: transferredIds,
            },
          }
        : item
    );
  }
  const achievements = state.achievements.map((achievement) =>
    unlockedByThisCompletion.has(achievement.id) && !eligibleAchievementIds.has(achievement.id)
      ? { ...achievement, unlockedAt: null }
      : achievement
  );

  return {
    state: {
      ...state,
      quests,
      categories,
      achievements,
      lifetimeCompletedQuestCount,
    },
    uncompleted: true,
    rewardsReversed: true,
  };
}
