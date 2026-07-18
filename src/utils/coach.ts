import { getCategoryDisplayNameById } from "./categoryLabels";
import { getLatestHistoryEntries } from "./evaluationAnalytics";
import type { DailyEvaluationHistoryItem } from "./evaluationHistory";
import { MAX_ACTIVE_QUESTS_PER_DAY } from "./questLimits";
import type { Quest } from "./types";

export type CoachPromptId = "next" | "slipping" | "week" | "load";

export type CoachPrompt = {
  id: CoachPromptId;
  label: string;
};

export type CoachTone = "positive" | "warning" | "neutral";

export type CoachResponse = {
  title: string;
  body: string;
  bullets: string[];
  metricLabel: string;
  metricValue: string;
  tone: CoachTone;
};

export type CoachInput = {
  todaysQuests: Quest[];
  evaluationHistory: DailyEvaluationHistoryItem[];
  strongestCategory: string;
  weakestCategory: string;
};

export const COACH_PROMPTS: CoachPrompt[] = [
  { id: "next", label: "Next move" },
  { id: "slipping", label: "Weak spot" },
  { id: "week", label: "This week" },
  { id: "load", label: "Board load" },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function averageCompletion(entries: DailyEvaluationHistoryItem[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, entry) => sum + clampPercent(entry.completionRate), 0);
  return Math.round(total / entries.length);
}

function getCategoryPressure(quests: Quest[]): {
  label: string;
  openCount: number;
  totalCount: number;
} | null {
  const statsByCategory = new Map<string, { openCount: number; totalCount: number }>();

  for (const quest of quests) {
    const current = statsByCategory.get(quest.categoryId) ?? { openCount: 0, totalCount: 0 };
    current.totalCount += 1;
    if (!quest.done) current.openCount += 1;
    statsByCategory.set(quest.categoryId, current);
  }

  const highestPressure = Array.from(statsByCategory.entries())
    .map(([categoryId, stats]) => ({
      label: getCategoryDisplayNameById(categoryId),
      ...stats,
    }))
    .filter((item) => item.openCount > 0)
    .sort((a, b) => {
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      return b.totalCount - a.totalCount;
    })[0];

  return highestPressure ?? null;
}

function buildNextMoveResponse(input: CoachInput): CoachResponse {
  const openQuests = input.todaysQuests.filter((quest) => !quest.done);
  const openContracts = openQuests.filter((quest) => quest.contract);
  const openEasy = openQuests.filter((quest) => quest.difficulty === "easy");
  const completedCount = input.todaysQuests.filter((quest) => quest.done).length;
  const totalCount = input.todaysQuests.length;
  const completionPct = totalCount > 0 ? clampPercent((completedCount / totalCount) * 100) : 0;

  if (totalCount === 0) {
    return {
      title: "Seed the board",
      body: "The day needs one real target before momentum can show up.",
      bullets: ["Add one easy quest", "Keep it specific", "Do it before adding more"],
      metricLabel: "Today",
      metricValue: "0 quests",
      tone: "neutral",
    };
  }

  if (openContracts.length > 0) {
    return {
      title: "Protect the contract",
      body: `${openContracts[0].title} is the highest-leverage move because it protects the day's contract floor.`,
      bullets: ["Open the contract first", "Make the next step tiny", "Ignore bonus work until it is safe"],
      metricLabel: "Open contracts",
      metricValue: `${openContracts.length}`,
      tone: "warning",
    };
  }

  if (openEasy.length > 0) {
    return {
      title: "Take the smallest win",
      body: `${openEasy[0].title} is the fastest way to raise today's floor.`,
      bullets: ["Do the easiest open quest", "Use that momentum immediately", "Avoid editing the board mid-run"],
      metricLabel: "Progress",
      metricValue: `${completionPct}%`,
      tone: completionPct >= 60 ? "positive" : "neutral",
    };
  }

  if (openQuests.length > 0) {
    return {
      title: "One serious rep",
      body: `${openQuests[0].title} is the next exposed quest. Give it one focused block.`,
      bullets: ["Work one quest only", "Stop when the next checkpoint is done", "Do not start a second hard task first"],
      metricLabel: "Open",
      metricValue: `${openQuests.length}`,
      tone: "neutral",
    };
  }

  return {
    title: "Hold the line",
    body: "The board is clear. Do not create fake urgency just to keep moving.",
    bullets: ["Leave the win intact", "Review tomorrow's plan", "Protect sleep before midnight"],
    metricLabel: "Progress",
    metricValue: "100%",
    tone: "positive",
  };
}

function buildSlippingResponse(input: CoachInput): CoachResponse {
  const latest7 = getLatestHistoryEntries(input.evaluationHistory, 7);
  const recent3 = latest7.slice(-3);
  const sevenAvg = averageCompletion(latest7);
  const recentAvg = averageCompletion(recent3);
  const categoryPressure = getCategoryPressure(input.todaysQuests);

  if (latest7.length === 0) {
    return {
      title: "No weak spot yet",
      body: "The signal needs a few midnight evaluations before it can call out a trend.",
      bullets: ["Finish today's board", "Let midnight evaluate", "Check back after two or three days"],
      metricLabel: "History",
      metricValue: "0 days",
      tone: "neutral",
    };
  }

  if (recent3.length >= 2 && recentAvg <= sevenAvg - 8) {
    return {
      title: "Recent consistency is slipping",
      body: `The last ${recent3.length} evaluations average ${recentAvg}%, below the 7-day baseline of ${sevenAvg}%.`,
      bullets: [`Make ${input.weakestCategory} smaller`, "Protect one contract early", "Cut bonus quests until the floor returns"],
      metricLabel: "Recent avg",
      metricValue: `${recentAvg}%`,
      tone: "warning",
    };
  }

  if (categoryPressure) {
    return {
      title: `${categoryPressure.label} has the most pressure`,
      body: `${categoryPressure.openCount} open quest${categoryPressure.openCount === 1 ? "" : "s"} are sitting in that category today.`,
      bullets: ["Clear one quest from the pressure zone", "Do not add a replacement today", `Keep ${input.strongestCategory} in maintenance mode`],
      metricLabel: "Open",
      metricValue: `${categoryPressure.openCount}/${categoryPressure.totalCount}`,
      tone: categoryPressure.openCount >= 3 ? "warning" : "neutral",
    };
  }

  return {
    title: "No obvious leak",
    body: "Your recent pattern is not flashing a major warning. The best move is controlled repetition.",
    bullets: ["Repeat the daily floor", `Add one rep in ${input.weakestCategory}`, "Keep contracts boring and early"],
    metricLabel: "7D avg",
    metricValue: `${sevenAvg}%`,
    tone: "positive",
  };
}

function buildWeekResponse(input: CoachInput): CoachResponse {
  const latest7 = getLatestHistoryEntries(input.evaluationHistory, 7);
  const weeklyAvg = averageCompletion(latest7);
  const solidDays = latest7.filter((entry) => clampPercent(entry.completionRate) >= 60).length;
  const contractDays = latest7.filter(
    (entry) =>
      typeof entry.contractTotalCount === "number" &&
      entry.contractTotalCount > 0 &&
      entry.contractCompletedCount === entry.contractTotalCount
  ).length;
  const drDelta =
    latest7.length >= 2 ? latest7[latest7.length - 1].drAfter - latest7[0].drBefore : 0;

  if (latest7.length === 0) {
    return {
      title: "Build the first readout",
      body: "One completed day will unlock the weekly coaching signal.",
      bullets: ["Finish one daily standard", "Let midnight evaluate", "Return tomorrow with a real baseline"],
      metricLabel: "Week",
      metricValue: "0 days",
      tone: "neutral",
    };
  }

  if (weeklyAvg >= 85 && drDelta > 0) {
    return {
      title: "The week is clean",
      body: "The floor is holding. The upgrade is not more quests, it is better pressure.",
      bullets: [`Add one harder ${input.weakestCategory} rep`, "Keep contracts capped", "Preserve the same opening routine"],
      metricLabel: "7D avg",
      metricValue: `${weeklyAvg}%`,
      tone: "positive",
    };
  }

  if (weeklyAvg < 60) {
    return {
      title: "Rebuild the floor",
      body: "This week needs fewer open loops and earlier wins.",
      bullets: ["Keep tomorrow under 7 quests", "Make one contract the first task", `Shrink ${input.weakestCategory} until it is winnable`],
      metricLabel: "Solid days",
      metricValue: `${solidDays}/${latest7.length}`,
      tone: "warning",
    };
  }

  return {
    title: "The week is stable",
    body: "You are close enough to push, but not so safe that the board can get sloppy.",
    bullets: ["Keep the same quest count", "Raise one medium quest to hard", "Protect contract days before bonus XP"],
    metricLabel: "Contracts",
    metricValue: `${contractDays}/${latest7.length}`,
    tone: "neutral",
  };
}

function buildLoadResponse(input: CoachInput): CoachResponse {
  const activeCount = input.todaysQuests.length;
  const completedCount = input.todaysQuests.filter((quest) => quest.done).length;
  const openCount = activeCount - completedCount;
  const completionPct = activeCount > 0 ? clampPercent((completedCount / activeCount) * 100) : 0;
  const latest7 = getLatestHistoryEntries(input.evaluationHistory, 7);
  const weeklyAvg = averageCompletion(latest7);

  if (activeCount >= MAX_ACTIVE_QUESTS_PER_DAY) {
    return {
      title: "The board is at the cap",
      body: "Ten quests is the limit for a reason. No more additions today.",
      bullets: ["Finish or pause before adding", "Protect contracts first", "Move bonus ideas to another day"],
      metricLabel: "Load",
      metricValue: `${activeCount}/${MAX_ACTIVE_QUESTS_PER_DAY}`,
      tone: "warning",
    };
  }

  if (activeCount >= 8 && completionPct < 60) {
    return {
      title: "The board is heavy",
      body: "The load is high while completion is still below the daily floor.",
      bullets: ["Pause one low-value quest", "Finish one easy quest now", "Do not add templates today"],
      metricLabel: "Open",
      metricValue: `${openCount}`,
      tone: "warning",
    };
  }

  if (activeCount <= 5 && weeklyAvg >= 75) {
    return {
      title: "Room for controlled pressure",
      body: "The board is lean enough to add one meaningful rep without losing control.",
      bullets: [`Add one ${input.weakestCategory} quest`, "Keep it medium or easier", "Do not exceed seven total quests"],
      metricLabel: "Load",
      metricValue: `${activeCount}/${MAX_ACTIVE_QUESTS_PER_DAY}`,
      tone: "positive",
    };
  }

  return {
    title: "The load is workable",
    body: "The board is not overloaded. Execution matters more than rearranging.",
    bullets: ["Clear one open quest", "Pause only if the day changes", "Keep tomorrow near the same size"],
    metricLabel: "Load",
    metricValue: `${activeCount}/${MAX_ACTIVE_QUESTS_PER_DAY}`,
    tone: "neutral",
  };
}

export function buildCoachResponse(promptId: CoachPromptId, input: CoachInput): CoachResponse {
  switch (promptId) {
    case "slipping":
      return buildSlippingResponse(input);
    case "week":
      return buildWeekResponse(input);
    case "load":
      return buildLoadResponse(input);
    case "next":
    default:
      return buildNextMoveResponse(input);
  }
}
