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
  baseDrDelta: number;
  comebackBonus: number;
  contractCompletedCount: number;
  contractTotalCount: number;
  runTitle: string;
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

export function buildMidnightEvaluation(
  date: string,
  quests: Quest[],
  previousCompletionPercent: number | null = null
): MidnightEvaluationData {
  const completedCount = quests.filter((quest) => quest.done).length;
  const totalCount = quests.length;
  const completionPercent = getCompletionPercent(completedCount, DAILY_STANDARD);
  const baseDrDelta = getDRChangeFromPercent(completionPercent, totalCount, DAILY_STANDARD);
  const contractQuests = quests.filter((quest) => quest.contract);
  const contractCompletedCount = contractQuests.filter((quest) => quest.done).length;
  const contractTotalCount = contractQuests.length;
  const comebackBonus = getComebackBonus(previousCompletionPercent, completionPercent);
  const drDelta = baseDrDelta + comebackBonus;

  return {
    date,
    completedCount,
    totalCount,
    completionPercent,
    baseDrDelta,
    comebackBonus,
    contractCompletedCount,
    contractTotalCount,
    runTitle: getRunTitle({
      completedCount,
      totalCount,
      completionPercent,
      contractCompletedCount,
      contractTotalCount,
      comebackBonus,
    }),
    drDelta,
    insight: getEvaluationInsight(quests, completionPercent, contractCompletedCount, contractTotalCount, comebackBonus),
  };
}

function getComebackBonus(previousCompletionPercent: number | null, completionPercent: number): number {
  if (previousCompletionPercent === null) return 0;
  if (previousCompletionPercent < 30 && completionPercent >= 60) return 2;
  return 0;
}

function getRunTitle({
  completedCount,
  totalCount,
  completionPercent,
  contractCompletedCount,
  contractTotalCount,
  comebackBonus,
}: {
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  contractCompletedCount: number;
  contractTotalCount: number;
  comebackBonus: number;
}): string {
  if (totalCount > 0 && completedCount === totalCount) return "Perfect Day";
  if (contractTotalCount > 0 && contractCompletedCount < contractTotalCount) return "Contract Broken";
  if (comebackBonus > 0) return "Comeback Run";
  if (contractTotalCount > 0 && contractCompletedCount === contractTotalCount) return "Contract Honored";
  if (completionPercent >= 85) return "Clean Victory";
  if (completionPercent < 30) return "Midnight Claimed";
  return "Survived The Day";
}

function getEvaluationInsight(
  quests: Quest[],
  completionPercent: number,
  contractCompletedCount: number,
  contractTotalCount: number,
  comebackBonus: number
): string {
  if (contractTotalCount > 0 && contractCompletedCount === contractTotalCount) {
    return "Your Midnight Contract held. Choose tomorrow's promises carefully.";
  }

  if (contractTotalCount > 0 && contractCompletedCount < contractTotalCount) {
    return "The contract broke. Start tomorrow with the smallest contract quest first.";
  }

  if (comebackBonus > 0) {
    return "Comeback bonus earned. Recovery counts as discipline.";
  }

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
