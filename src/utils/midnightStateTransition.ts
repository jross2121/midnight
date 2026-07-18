import { getAchievementsAfterMidnightEvaluation } from "./achievements";
import { diffDays, offsetDateKey } from "./dateHelpers";
import type { MidnightEvaluationData } from "./midnightEvaluation";
import {
  getCompletedOneTimeArchives,
  rollQuestsForNewDay,
} from "./recurrence";
import { getRankFromDR } from "./rank";
import type { DrHistoryEntry, StoredState } from "./types";

export type MidnightStateTransitionResult = {
  state: StoredState;
  applied: boolean;
  drBeforeEvaluation: number;
  drAfterEvaluation: number;
  rankAfterEvaluation: string;
};

function applyDrChange(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

export function applyMidnightStateTransition(
  state: StoredState,
  evaluation: MidnightEvaluationData,
  todayDateKey: string,
  evaluatedAt: string
): MidnightStateTransitionResult {
  const existingEntry = state.drHistory.find((entry) => entry.date === evaluation.date);
  if (existingEntry) {
    return {
      state,
      applied: false,
      drBeforeEvaluation: applyDrChange(existingEntry.dr, -existingEntry.delta),
      drAfterEvaluation: existingEntry.dr,
      rankAfterEvaluation: getRankFromDR(existingEntry.dr),
    };
  }

  const drBeforeEvaluation = state.disciplineRating;
  const drAfterEvaluation = applyDrChange(drBeforeEvaluation, evaluation.drDelta);
  let disciplineRating = drAfterEvaluation;
  const history: DrHistoryEntry[] = [
    ...state.drHistory,
    {
      date: evaluation.date,
      dr: disciplineRating,
      delta: evaluation.drDelta,
      pct: evaluation.completionPercent,
      title: evaluation.runTitle,
      contractCompletedCount: evaluation.contractCompletedCount,
      contractTotalCount: evaluation.contractTotalCount,
      comebackBonus: evaluation.comebackBonus,
      recoveryDay: evaluation.recoveryDay || undefined,
    },
  ];

  const gap = Math.max(1, diffDays(evaluation.date, todayDateKey));
  for (let dayOffset = 1; dayOffset < gap; dayOffset += 1) {
    const missedDate = offsetDateKey(evaluation.date, dayOffset);
    if (history.some((entry) => entry.date === missedDate)) continue;

    disciplineRating = applyDrChange(disciplineRating, -8);
    history.push({
      date: missedDate,
      dr: disciplineRating,
      delta: -8,
      pct: 0,
      title: "Midnight Claimed",
      contractCompletedCount: 0,
      contractTotalCount: 0,
      comebackBonus: 0,
    });
  }

  const drHistory = history.slice(-30);
  const latestEntry = drHistory[drHistory.length - 1];
  const archivedQuests = [
    ...getCompletedOneTimeArchives(state.quests, evaluatedAt),
    ...state.archivedQuests,
  ].slice(0, 100);
  const achievements = getAchievementsAfterMidnightEvaluation({
    achievements: state.achievements,
    drHistory,
    disciplineRating: drAfterEvaluation,
    evaluation,
    unlockedAt: evaluatedAt,
  });

  return {
    applied: true,
    drBeforeEvaluation,
    drAfterEvaluation,
    rankAfterEvaluation: getRankFromDR(drAfterEvaluation),
    state: {
      ...state,
      disciplineRating,
      drHistory,
      lastDrDelta: latestEntry?.delta ?? evaluation.drDelta,
      lastCompletionPct: latestEntry?.pct ?? evaluation.completionPercent,
      lastDrUpdateDate: todayDateKey,
      archivedQuests,
      quests: rollQuestsForNewDay(state.quests),
      lastResetDate: todayDateKey,
      achievements,
    },
  };
}
