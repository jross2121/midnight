import { getCategoryDisplayNameById } from "./categoryLabels";
import { diffDays } from "./dateHelpers";
import {
  DAILY_STANDARD,
  getCompletionPercent,
  getDailyScoringTarget,
  getDRChangeFromPercent,
} from "./discipline";
import { getScheduledQuestsForDate } from "./recurrence";
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
  recoveryDay: boolean;
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
  previousCompletionPercent: number | null = null,
  recoveryDay = false
): MidnightEvaluationData {
  const scoredQuests = getScheduledQuestsForDate(quests, date);
  const completedCount = scoredQuests.filter((quest) => quest.done).length;
  const totalCount = scoredQuests.length;
  const scoringTarget = getDailyScoringTarget(totalCount, DAILY_STANDARD);
  const completionPercent = getCompletionPercent(completedCount, scoringTarget);
  const baseDrDelta = getDRChangeFromPercent(completionPercent, totalCount, DAILY_STANDARD);
  const contractQuests = scoredQuests.filter((quest) => quest.contract);
  const contractCompletedCount = contractQuests.filter((quest) => quest.done).length;
  const contractTotalCount = contractQuests.length;
  const comebackBonus = recoveryDay ? 0 : getComebackBonus(previousCompletionPercent, completionPercent);
  const drDelta = recoveryDay ? 0 : baseDrDelta + comebackBonus;

  return {
    date,
    completedCount,
    totalCount,
    completionPercent,
    baseDrDelta,
    comebackBonus,
    contractCompletedCount,
    contractTotalCount,
    runTitle: recoveryDay ? "Recovery Day" : getRunTitle({
      completedCount,
      totalCount,
      completionPercent,
      contractCompletedCount,
      contractTotalCount,
      comebackBonus,
    }),
    drDelta,
    insight: recoveryDay
      ? "Recovery Day froze DR and streak state. Quest XP still counted, but this day did not improve rank or unlock awards."
      : getEvaluationInsight(scoredQuests, completionPercent, contractCompletedCount, contractTotalCount, comebackBonus),
    recoveryDay,
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
  return "Survived the Day";
}

function getEvaluationInsight(
  quests: Quest[],
  completionPercent: number,
  contractCompletedCount: number,
  contractTotalCount: number,
  comebackBonus: number
): string {
  if (contractTotalCount > 0 && contractCompletedCount === contractTotalCount) {
    return "Your Midnight Contract held. Choose tomorrow's contracts carefully.";
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
