import { getAchievementsAfterMidnightEvaluation } from "./achievements";
import { getCategoryDisplayNameById } from "./categoryLabels";
import { diffDays, offsetDateKey } from "./dateHelpers";
import type { MidnightEvaluationData } from "./midnightEvaluation";
import {
  getCompletedOneTimeArchives,
  getScheduledQuestsForDate,
  rollQuestsForNewDay,
} from "./recurrence";
import { buildStreakSummary } from "./planning";
import { DR_RANK_THRESHOLDS, getRankFromDR } from "./rank";
import type { DrHistoryEntry, RankPromotionRecord, StoredState } from "./types";

export type MidnightStateTransitionResult = {
  state: StoredState;
  applied: boolean;
  drBeforeEvaluation: number;
  drAfterEvaluation: number;
  rankAfterEvaluation: string;
  promotions: RankPromotionRecord[];
};

function applyDrChange(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

function getStrongestCompletedCategory(state: StoredState, evaluation: MidnightEvaluationData): string | undefined {
  const totals = new Map<string, number>();
  getScheduledQuestsForDate(state.quests, evaluation.date)
    .filter((quest) => quest.done)
    .forEach((quest) => totals.set(quest.categoryId, (totals.get(quest.categoryId) ?? 0) + quest.xp));
  const strongest = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return strongest ? getCategoryDisplayNameById(strongest[0]) : undefined;
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
      promotions: [],
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
  const streak = buildStreakSummary(drHistory).solidDayStreak;
  const strongestCategory = getStrongestCompletedCategory(state, evaluation);
  const promotions: RankPromotionRecord[] = DR_RANK_THRESHOLDS
    .filter((rank) => rank.minDr > drBeforeEvaluation && rank.minDr <= disciplineRating)
    .map((rank) => ({
      id: `promotion:${evaluation.date}:${rank.name}`,
      date: evaluation.date,
      unlockedAt: evaluatedAt,
      fromRank: getRankFromDR(Math.max(0, rank.minDr - 1)),
      rank: rank.name,
      drBefore: drBeforeEvaluation,
      drAfter: disciplineRating,
      drGained: disciplineRating - drBeforeEvaluation,
      dayScore: evaluation.completionPercent,
      streak,
      strongestCategory,
      contractCompletedCount: evaluation.contractCompletedCount,
      contractTotalCount: evaluation.contractTotalCount,
    }));
  const rankPromotions = [
    ...(state.rankPromotions ?? []),
    ...promotions.filter(
      (promotion) => !(state.rankPromotions ?? []).some((existing) => existing.id === promotion.id)
    ),
  ].slice(-50);

  return {
    applied: true,
    drBeforeEvaluation,
    drAfterEvaluation,
    rankAfterEvaluation: getRankFromDR(drAfterEvaluation),
    promotions,
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
      rankPromotions,
    },
  };
}
