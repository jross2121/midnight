import type { DailyEvaluationHistoryItem } from "./evaluationHistory";

export type CalendarDayMetric = {
  date: string;
  completionPct: number;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toEpochDay(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Date.UTC(year, month - 1, day);
}

export function sortEvaluationHistory(
  history: DailyEvaluationHistoryItem[]
): DailyEvaluationHistoryItem[] {
  return [...history].sort((a, b) => toEpochDay(a.date) - toEpochDay(b.date));
}

export function getLatestHistoryEntries(
  history: DailyEvaluationHistoryItem[],
  count: number
): DailyEvaluationHistoryItem[] {
  if (count <= 0) return [];
  const sorted = sortEvaluationHistory(history);
  return sorted.slice(-count);
}

export function buildCalendarFromHistory(
  history: DailyEvaluationHistoryItem[],
  totalDays = 30
): CalendarDayMetric[] {
  const latest = getLatestHistoryEntries(history, totalDays);
  const pctByDate = new Map(latest.map((entry) => [entry.date, clampPercent(entry.completionRate)]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const days: CalendarDayMetric[] = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateKey = toDateKey(date);
    days.push({
      date: dateKey,
      completionPct: pctByDate.get(dateKey) ?? 0,
    });
  }

  return days;
}

export function getTrendPointsFromHistory(
  history: DailyEvaluationHistoryItem[],
  count = 7
): number[] {
  return getLatestHistoryEntries(history, count).map((entry) => entry.drAfter);
}

export function getAverageCompletionRate(history: DailyEvaluationHistoryItem[]): number {
  const latest30 = getLatestHistoryEntries(history, 30);
  if (latest30.length === 0) return 0;
  const total = latest30.reduce((sum, entry) => sum + clampPercent(entry.completionRate), 0);
  return Math.round(total / latest30.length);
}

export function getSevenDayDrChange(history: DailyEvaluationHistoryItem[]): number {
  const latest7 = getLatestHistoryEntries(history, 7);
  if (latest7.length < 2) return 0;
  return latest7[latest7.length - 1].drAfter - latest7[0].drAfter;
}

export function getCurrentRankFromHistory(history: DailyEvaluationHistoryItem[]): string | null {
  const latest = getLatestHistoryEntries(history, 1)[0];
  return latest?.currentRank ?? null;
}

export function getLatestCategoriesFromHistory(history: DailyEvaluationHistoryItem[]): {
  strongestCategory: string | null;
  weakestCategory: string | null;
} {
  const sorted = sortEvaluationHistory(history);
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const item = sorted[i];
    if (item.strongestCategory || item.weakestCategory) {
      return {
        strongestCategory: item.strongestCategory,
        weakestCategory: item.weakestCategory,
      };
    }

    if (item.categoryStats) {
      const entries = Object.entries(item.categoryStats).map(([label, stats]) => ({
        label,
        completionRate: stats.completionRate,
        completedCount: stats.completedCount,
        totalCount: stats.totalCount,
      }));

      const withData = entries.filter((entry) => entry.totalCount > 0);
      if (withData.length > 0) {
        const strongest = [...withData].sort((a, b) => {
          if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
          if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
          return b.totalCount - a.totalCount;
        })[0];

        const weakest = [...withData].sort((a, b) => {
          if (a.completionRate !== b.completionRate) return a.completionRate - b.completionRate;
          if (a.completedCount !== b.completedCount) return a.completedCount - b.completedCount;
          return b.totalCount - a.totalCount;
        })[0];

        return {
          strongestCategory: strongest?.label ?? null,
          weakestCategory:
            weakest && strongest && weakest.label !== strongest.label
              ? weakest.label
              : null,
        };
      }
    }
  }

  return {
    strongestCategory: null,
    weakestCategory: null,
  };
}

export function buildInsightOfTheDay(history: DailyEvaluationHistoryItem[]): string {
  const latest7 = getLatestHistoryEntries(history, 7);
  if (latest7.length === 0) {
    return "Complete your first Midnight Evaluation to unlock real trend insights.";
  }

  const latest = latest7[latest7.length - 1];
  const recent3 = latest7.slice(-3);
  const recent3Avg = Math.round(
    recent3.reduce((sum, entry) => sum + clampPercent(entry.completionRate), 0) / recent3.length
  );
  const avg7 = Math.round(
    latest7.reduce((sum, entry) => sum + clampPercent(entry.completionRate), 0) / latest7.length
  );

  if (recent3Avg >= avg7 + 8) {
    return `Momentum is rising: last 3 days average ${recent3Avg}% vs ${avg7}% over 7 days.`;
  }

  if (recent3Avg <= avg7 - 8) {
    return `Recent consistency dipped to ${recent3Avg}% (7-day average ${avg7}%). Start tomorrow with one easy win.`;
  }

  if (latest.completionRate >= 85) {
    return `Strong finish yesterday at ${clampPercent(latest.completionRate)}%. Repeat the same opening routine today.`;
  }

  return `You're steady at ${avg7}% over the last ${latest7.length} evaluations. One extra completed quest can shift the trend up.`;
}
