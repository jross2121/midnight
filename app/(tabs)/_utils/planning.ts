import { DAILY_STANDARD, getDailyScoringTarget, getDRChangeFromPercent } from "./discipline";
import type { DrHistoryEntry, Quest } from "./types";

export type PlanSummary = {
  targetPercent: number;
  completedCount: number;
  targetQuestCount: number;
  remainingForTarget: number;
  projectedDelta: number;
  nextDelta: number;
  title: string;
  body: string;
};

export type StreakSummary = {
  solidDayStreak: number;
  contractStreak: number;
  bestSolidDayStreak: number;
};

export type NextDayPlan = {
  title: string;
  body: string;
  steps: string[];
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isSolidDay(entry: DrHistoryEntry): boolean {
  return clampPercent(entry.pct) >= 60;
}

function isContractProtected(entry: DrHistoryEntry): boolean {
  if (typeof entry.contractTotalCount !== "number" || entry.contractTotalCount <= 0) {
    return false;
  }
  return entry.contractCompletedCount === entry.contractTotalCount;
}

export function buildStreakSummary(history: DrHistoryEntry[]): StreakSummary {
  let solidDayStreak = 0;
  let contractStreak = 0;
  let bestSolidDayStreak = 0;
  let runningSolid = 0;

  for (const entry of history) {
    if (isSolidDay(entry)) {
      runningSolid += 1;
      bestSolidDayStreak = Math.max(bestSolidDayStreak, runningSolid);
    } else {
      runningSolid = 0;
    }
  }

  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (!isSolidDay(history[i])) break;
    solidDayStreak += 1;
  }

  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (!isContractProtected(history[i])) break;
    contractStreak += 1;
  }

  return {
    solidDayStreak,
    contractStreak,
    bestSolidDayStreak,
  };
}

export function buildPlanSummary(quests: Quest[]): PlanSummary {
  const completedCount = quests.filter((quest) => quest.done).length;
  const totalCount = quests.length;
  const targetQuestCount = Math.max(1, getDailyScoringTarget(totalCount, DAILY_STANDARD));
  const currentPercent =
    targetQuestCount > 0 ? clampPercent((completedCount / targetQuestCount) * 100) : 0;
  const projectedDelta = getDRChangeFromPercent(currentPercent, totalCount, DAILY_STANDARD);

  const preferredTargets = [100, 85, 60, 30];
  const targetPercent = preferredTargets.find((target) => currentPercent < target) ?? 100;
  const neededForTarget = Math.ceil((targetPercent / 100) * targetQuestCount);
  const remainingForTarget = Math.max(0, neededForTarget - completedCount);
  const nextPercent =
    targetQuestCount > 0
      ? clampPercent(((completedCount + Math.min(remainingForTarget || 1, 1)) / targetQuestCount) * 100)
      : 0;
  const nextDelta = getDRChangeFromPercent(nextPercent, totalCount, DAILY_STANDARD);

  if (totalCount === 0) {
    return {
      targetPercent: 0,
      completedCount,
      targetQuestCount,
      remainingForTarget: 1,
      projectedDelta,
      nextDelta,
      title: "Build today's board",
      body: "Add one easy quest and one contract so midnight has something real to judge.",
    };
  }

  if (completedCount >= targetQuestCount) {
    return {
      targetPercent: 100,
      completedCount,
      targetQuestCount,
      remainingForTarget: 0,
      projectedDelta,
      nextDelta: projectedDelta,
      title: "Daily standard cleared",
      body: "You have enough completions for a perfect discipline signal. Bonus quests now build category XP.",
    };
  }

  return {
    targetPercent,
    completedCount,
    targetQuestCount,
    remainingForTarget,
    projectedDelta,
    nextDelta,
    title: `${remainingForTarget} quest${remainingForTarget === 1 ? "" : "s"} to ${targetPercent}%`,
    body:
      nextDelta > projectedDelta
        ? "The next completion improves tonight's DR outcome. Take the smallest exposed quest now."
        : "Keep stacking completions. Contracts and pinned quests give the day its backbone.",
  };
}

export function buildNextDayPlan(quests: Quest[], history: DrHistoryEntry[]): NextDayPlan {
  const openContracts = quests.filter((quest) => quest.contract && !quest.done);
  const openPinned = quests.filter((quest) => quest.pinned && !quest.done);
  const openHard = quests.filter((quest) => quest.difficulty === "hard" && !quest.done);
  const streakSummary = buildStreakSummary(history);
  const latest = history[history.length - 1];

  if (quests.length === 0) {
    return {
      title: "Seed tomorrow",
      body: "Add one easy quest and one contract before the next run starts.",
      steps: ["Add one easy quest", "Choose one contract", "Keep the board small"],
    };
  }

  if (latest && latest.pct < 60) {
    return {
      title: "Protect the floor",
      body: "Tomorrow should be smaller and earlier. Clear one contract before adding pressure.",
      steps: ["One contract first", "One easy win", "Stop at a clean 60%"],
    };
  }

  if (openContracts.length > 0) {
    return {
      title: "Contracts first",
      body: `${openContracts.length} contract${openContracts.length === 1 ? "" : "s"} need priority before any bonus work.`,
      steps: ["Open contracts", "Smallest visible quest", "Then pinned work"],
    };
  }

  if (streakSummary.solidDayStreak >= 3 && openHard.length > 0) {
    return {
      title: "Add controlled pressure",
      body: "The floor is holding. Add one hard rep without risking the daily standard.",
      steps: ["Quick first win", "One hard quest", "Close at 85%+"],
    };
  }

  if (openPinned.length > 0) {
    return {
      title: "Pinned priority",
      body: "A pinned quest is already telling you where the day should start.",
      steps: ["Pinned quest", "Contract check", "One easy follow-up"],
    };
  }

  return {
    title: "Repeat the floor",
    body: "The board is stable. Clear the daily standard, then add one intentional extra.",
    steps: ["Hit 60%", "Protect contracts", "One bonus rep"],
  };
}
