import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCategoryDisplayNameById } from "./categoryLabels";
import type { Quest } from "./types";

export const DAILY_EVALUATION_HISTORY_STORAGE_KEY = "lifeRpg:daily-evaluation-history:v1";

const TRACKED_CATEGORY_IDS = ["health", "money", "career", "social", "home", "fun"] as const;

type TrackedCategoryId = (typeof TRACKED_CATEGORY_IDS)[number];

export type DailyEvaluationCategoryStat = {
  completedCount: number;
  totalCount: number;
  completionRate: number;
};

export type DailyEvaluationCategoryStats = Record<
  "Health" | "Money" | "Career" | "Social" | "Home" | "Personal",
  DailyEvaluationCategoryStat
>;

export type DailyEvaluationHistoryItem = {
  date: string;
  completedQuestCount: number;
  totalQuestCount: number;
  completionRate: number;
  runTitle?: string;
  contractCompletedCount?: number;
  contractTotalCount?: number;
  comebackBonus?: number;
  drBefore: number;
  drChange: number;
  drAfter: number;
  currentRank: string;
  strongestCategory: string | null;
  weakestCategory: string | null;
  categoryStats?: DailyEvaluationCategoryStats;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isCategoryStat(value: unknown): value is DailyEvaluationCategoryStat {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DailyEvaluationCategoryStat>;
  return (
    typeof candidate.completedCount === "number" &&
    typeof candidate.totalCount === "number" &&
    typeof candidate.completionRate === "number"
  );
}

function isCategoryStats(value: unknown): value is DailyEvaluationCategoryStats {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DailyEvaluationCategoryStats>;
  return (
    isCategoryStat(candidate.Health) &&
    isCategoryStat(candidate.Money) &&
    isCategoryStat(candidate.Career) &&
    isCategoryStat(candidate.Social) &&
    isCategoryStat(candidate.Home) &&
    isCategoryStat(candidate.Personal)
  );
}

function isDailyEvaluationHistoryItem(value: unknown): value is DailyEvaluationHistoryItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DailyEvaluationHistoryItem>;

  return (
    typeof candidate.date === "string" &&
    typeof candidate.completedQuestCount === "number" &&
    typeof candidate.totalQuestCount === "number" &&
    typeof candidate.completionRate === "number" &&
    (typeof candidate.runTitle === "undefined" || typeof candidate.runTitle === "string") &&
    (typeof candidate.contractCompletedCount === "undefined" || typeof candidate.contractCompletedCount === "number") &&
    (typeof candidate.contractTotalCount === "undefined" || typeof candidate.contractTotalCount === "number") &&
    (typeof candidate.comebackBonus === "undefined" || typeof candidate.comebackBonus === "number") &&
    typeof candidate.drBefore === "number" &&
    typeof candidate.drChange === "number" &&
    typeof candidate.drAfter === "number" &&
    typeof candidate.currentRank === "string" &&
    (typeof candidate.strongestCategory === "string" || candidate.strongestCategory === null) &&
    (typeof candidate.weakestCategory === "string" || candidate.weakestCategory === null) &&
    (typeof candidate.categoryStats === "undefined" || isCategoryStats(candidate.categoryStats))
  );
}

export async function readEvaluationHistory(): Promise<DailyEvaluationHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_EVALUATION_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is DailyEvaluationHistoryItem => isDailyEvaluationHistoryItem(entry));
  } catch {
    return [];
  }
}

export function hasEvaluationHistoryEntryForDate(
  history: DailyEvaluationHistoryItem[],
  date: string
): boolean {
  return history.some((entry) => entry.date === date);
}

export async function appendEvaluationHistoryItem(
  item: DailyEvaluationHistoryItem
): Promise<DailyEvaluationHistoryItem[]> {
  const history = await readEvaluationHistory();
  if (hasEvaluationHistoryEntryForDate(history, item.date)) {
    return history;
  }

  const nextHistory = [...history, item];
  await AsyncStorage.setItem(DAILY_EVALUATION_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function getStrongestAndWeakestCategories(quests: Quest[]): {
  strongestCategory: string | null;
  weakestCategory: string | null;
} {
  if (quests.length === 0) {
    return { strongestCategory: null, weakestCategory: null };
  }

  const statsByCategory = new Map<string, { total: number; done: number; rate: number }>();
  for (const quest of quests) {
    const current = statsByCategory.get(quest.categoryId) ?? { total: 0, done: 0, rate: 0 };
    current.total += 1;
    if (quest.done) current.done += 1;
    statsByCategory.set(quest.categoryId, current);
  }

  const categoryStats = Array.from(statsByCategory.entries()).map(([categoryId, stats]) => ({
    categoryId,
    total: stats.total,
    done: stats.done,
    rate: stats.total > 0 ? stats.done / stats.total : 0,
  }));

  if (categoryStats.length === 0) {
    return { strongestCategory: null, weakestCategory: null };
  }

  const strongest = [...categoryStats].sort((a, b) => {
    if (b.rate !== a.rate) return b.rate - a.rate;
    if (b.done !== a.done) return b.done - a.done;
    return b.total - a.total;
  })[0];

  const weakest = [...categoryStats].sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    if (a.done !== b.done) return a.done - b.done;
    return b.total - a.total;
  })[0];

  return {
    strongestCategory: strongest
      ? getCategoryDisplayNameById(strongest.categoryId)
      : null,
    weakestCategory:
      weakest && strongest && weakest.categoryId !== strongest.categoryId
        ? getCategoryDisplayNameById(weakest.categoryId)
        : null,
  };
}

function normalizeTrackedCategoryId(categoryId: string): TrackedCategoryId | null {
  const normalized = categoryId.trim().toLowerCase();
  if (normalized === "personal") return "fun";
  return TRACKED_CATEGORY_IDS.includes(normalized as TrackedCategoryId)
    ? (normalized as TrackedCategoryId)
    : null;
}

function getCategoryLabel(categoryId: TrackedCategoryId): keyof DailyEvaluationCategoryStats {
  return getCategoryDisplayNameById(categoryId) as keyof DailyEvaluationCategoryStats;
}

export function buildCategoryStatsFromQuests(quests: Quest[]): DailyEvaluationCategoryStats {
  const countsByCategory: Record<TrackedCategoryId, { completedCount: number; totalCount: number }> = {
    health: { completedCount: 0, totalCount: 0 },
    money: { completedCount: 0, totalCount: 0 },
    career: { completedCount: 0, totalCount: 0 },
    social: { completedCount: 0, totalCount: 0 },
    home: { completedCount: 0, totalCount: 0 },
    fun: { completedCount: 0, totalCount: 0 },
  };

  for (const quest of quests) {
    const trackedId = normalizeTrackedCategoryId(quest.categoryId);
    if (!trackedId) continue;

    countsByCategory[trackedId].totalCount += 1;
    if (quest.done) {
      countsByCategory[trackedId].completedCount += 1;
    }
  }

  const stats: Partial<DailyEvaluationCategoryStats> = {};
  for (const categoryId of TRACKED_CATEGORY_IDS) {
    const label = getCategoryLabel(categoryId);
    const counts = countsByCategory[categoryId];
    stats[label] = {
      completedCount: counts.completedCount,
      totalCount: counts.totalCount,
      completionRate:
        counts.totalCount > 0
          ? clampPercent((counts.completedCount / counts.totalCount) * 100)
          : 0,
    };
  }

  return stats as DailyEvaluationCategoryStats;
}
