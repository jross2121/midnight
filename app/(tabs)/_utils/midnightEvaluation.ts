import { getCategoryDisplayNameById } from "./categoryLabels";
import { diffDays } from "./dateHelpers";
import { DAILY_STANDARD, getCompletionPercent, getDRChangeFromPercent } from "./discipline";
import type { Quest } from "./types";

export const MIDNIGHT_EVALUATION_STORAGE_KEY = "lifeRpg:midnight-evaluation:v1";

export type MidnightEvaluationData = {
  date: string;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  drDelta: number;
  insight: string;
};

export function shouldShowMidnightEvaluation(
  lastResetDate: string,
  todayDate: string,
  lastEvaluatedDate: string | null
): boolean {
  if (!lastResetDate) return false;
  if (diffDays(lastResetDate, todayDate) < 1) return false;
  return lastEvaluatedDate !== lastResetDate;
}

export function buildMidnightEvaluation(date: string, quests: Quest[]): MidnightEvaluationData {
  const completedCount = quests.filter((quest) => quest.done).length;
  const totalCount = quests.length;
  const completionPercent = getCompletionPercent(completedCount, DAILY_STANDARD);
  const drDelta = getDRChangeFromPercent(completionPercent, totalCount, DAILY_STANDARD);

  return {
    date,
    completedCount,
    totalCount,
    completionPercent,
    drDelta,
    insight: getEvaluationInsight(quests, completionPercent),
  };
}

function getEvaluationInsight(quests: Quest[], completionPercent: number): string {
  const categoryMessage = getCategoryInsight(quests);
  if (categoryMessage) return categoryMessage;

  if (completionPercent >= 85) {
    return "Strong consistency yesterday.";
  }

  if (completionPercent < 50) {
    return "Completion dropped below 50%. Try starting with an easier quest.";
  }

  if (completionPercent >= 60) {
    return "Solid follow-through yesterday. Protect this momentum today.";
  }

  return "Yesterday was uneven. Start with one quick win this morning.";
}

function getCategoryInsight(quests: Quest[]): string | null {
  if (quests.length === 0) return null;

  const statsByCategory = new Map<string, { total: number; done: number }>();
  for (const quest of quests) {
    const current = statsByCategory.get(quest.categoryId) ?? { total: 0, done: 0 };
    current.total += 1;
    if (quest.done) current.done += 1;
    statsByCategory.set(quest.categoryId, current);
  }

  for (const [categoryId, stats] of statsByCategory) {
    if (stats.total >= 2 && stats.done === stats.total) {
      return `${getCategoryDisplayNameById(categoryId)} quests are consistently completed.`;
    }
  }

  return null;
}