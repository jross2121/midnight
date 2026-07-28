import {
  defaultCategories,
  defaultDisciplineRating,
  defaultDrHistory,
  defaultLastCompletionPct,
  defaultLastDrDelta,
  defaultLastDrUpdateDate,
  defaultQuests,
} from "./defaultData";
import { mergeAchievements } from "./achievements";
import { isValidDateKey, localDateKey, normalizeResetDateKey } from "./dateHelpers";
import {
  normalizeEvaluationHistory,
  type DailyEvaluationHistoryItem,
} from "./evaluationHistory";
import { getQuestXpForDifficulty } from "./questXp";
import { normalizeQuestRepeat, normalizeScheduledWeekday } from "./recurrence";
import { normalizeRecoveryDays } from "./recoveryDays";
import { DR_RANK_THRESHOLDS } from "./rank";
import { normalizeReminderSettings, type ReminderSettings } from "./reminders";
import {
  STORAGE_KEY,
  type ArchivedQuest,
  type Category,
  type DailyReflection,
  type DrHistoryEntry,
  type Quest,
  type QuestCompletionReceipt,
  type RankPromotionRecord,
  type StoredState,
} from "./types";

export type DataExportPayload = {
  version: 1;
  exportedAt: string;
  storageKey: typeof STORAGE_KEY;
  state: Partial<StoredState> | null;
  evaluationHistory: unknown[] | null;
  lastEvaluatedDate: string | null;
  reminders?: ReminderSettings | null;
};

export type ParsedImportPayload = {
  state: StoredState;
  evaluationHistory?: DailyEvaluationHistoryItem[];
  lastEvaluatedDate?: string | null;
  reminders?: ReminderSettings;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback: number, min = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.floor(value))
    : fallback;
}

function safePercent(value: unknown, fallback: number): number {
  const numeric = safeNumber(value, fallback);
  return Math.max(0, Math.min(100, numeric));
}

function normalizeDifficulty(value: unknown): Quest["difficulty"] {
  return value === "medium" || value === "hard" ? value : "easy";
}

function normalizeCategory(value: unknown, fallback: Category): Category {
  const candidate = isObject(value) ? value : {};
  const id = safeString(candidate.id, fallback.id);

  return {
    id,
    name: safeString(candidate.name, fallback.name),
    level: safeNumber(candidate.level, fallback.level),
    xp: safeNumber(candidate.xp, fallback.xp),
    xpToNext: safeNumber(candidate.xpToNext, fallback.xpToNext, 1),
  };
}

function normalizeCompletionReceipt(
  value: unknown,
  categoryId: string
): QuestCompletionReceipt | undefined {
  if (!isObject(value) || !isValidDateKey(value.dateKey) || !isObject(value.categoryBefore)) {
    return undefined;
  }

  const categoryBefore = value.categoryBefore;
  const completedAt = safeString(value.completedAt, "");
  if (!completedAt) return undefined;

  return {
    dateKey: value.dateKey,
    completedAt,
    awardedXp: safeNumber(value.awardedXp, 0),
    categoryBefore: {
      id: categoryId,
      name: safeString(categoryBefore.name, categoryId),
      level: safeNumber(categoryBefore.level, 1, 1),
      xp: safeNumber(categoryBefore.xp, 0),
      xpToNext: safeNumber(categoryBefore.xpToNext, 90, 1),
    },
    unlockedAchievementIds: Array.isArray(value.unlockedAchievementIds)
      ? value.unlockedAchievementIds.filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0
        )
      : [],
  };
}

function normalizeQuest(
  value: unknown,
  fallbackCategoryId: string,
  categoryIds: ReadonlySet<string>
): Quest | null {
  if (!isObject(value)) return null;

  const title = safeString(value.title, "");
  if (!title) return null;

  const difficulty = normalizeDifficulty(value.difficulty);
  const repeat = normalizeQuestRepeat(value.repeat);
  const requestedCategoryId = safeString(value.categoryId, fallbackCategoryId);
  const categoryId = categoryIds.has(requestedCategoryId)
    ? requestedCategoryId
    : fallbackCategoryId;

  return {
    id: safeString(value.id, `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    title,
    categoryId,
    xp: getQuestXpForDifficulty(difficulty),
    target: typeof value.target === "string" ? value.target : "",
    difficulty,
    repeat,
    scheduledWeekday:
      repeat === "weekly" ? normalizeScheduledWeekday(value.scheduledWeekday) : undefined,
    scheduledDate:
      repeat === "once" && isValidDateKey(value.scheduledDate)
        ? value.scheduledDate
        : undefined,
    done: Boolean(value.done),
    pinned: Boolean(value.pinned),
    contract: Boolean(value.contract),
    paused: Boolean(value.paused),
    completionReceipt: Boolean(value.done)
      ? normalizeCompletionReceipt(value.completionReceipt, categoryId)
      : undefined,
  };
}

function normalizeArchivedQuest(
  value: unknown,
  fallbackCategoryId: string,
  categoryIds: ReadonlySet<string>
): ArchivedQuest | null {
  const quest = normalizeQuest(value, fallbackCategoryId, categoryIds);
  if (!quest || !isObject(value)) return null;

  return {
    ...quest,
    archivedAt:
      typeof value.archivedAt === "string" && value.archivedAt.trim().length > 0
        ? value.archivedAt
        : new Date().toISOString(),
  };
}

function normalizeDrHistory(value: unknown): DrHistoryEntry[] {
  if (!Array.isArray(value)) return defaultDrHistory;

  const normalizedHistory: DrHistoryEntry[] = [];

  for (const rawEntry of value) {
    if (!isObject(rawEntry) || !isValidDateKey(rawEntry.date)) continue;

    const entry: DrHistoryEntry = {
      date: rawEntry.date,
      dr: safeNumber(rawEntry.dr, defaultDisciplineRating),
      delta:
        typeof rawEntry.delta === "number" && Number.isFinite(rawEntry.delta)
          ? Math.floor(rawEntry.delta)
          : defaultLastDrDelta,
      pct: safePercent(rawEntry.pct, defaultLastCompletionPct),
    };

    if (typeof rawEntry.title === "string") {
      entry.title = rawEntry.title;
    }
    if (typeof rawEntry.contractCompletedCount === "number") {
      entry.contractCompletedCount = Math.max(0, Math.floor(rawEntry.contractCompletedCount));
    }
    if (typeof rawEntry.contractTotalCount === "number") {
      entry.contractTotalCount = Math.max(0, Math.floor(rawEntry.contractTotalCount));
    }
    if (typeof rawEntry.comebackBonus === "number" && Number.isFinite(rawEntry.comebackBonus)) {
      entry.comebackBonus = Math.floor(rawEntry.comebackBonus);
    }
    if (rawEntry.recoveryDay === true) {
      entry.recoveryDay = true;
    }

    const existingIndex = normalizedHistory.findIndex((item) => item.date === entry.date);
    if (existingIndex >= 0) {
      normalizedHistory[existingIndex] = entry;
    } else {
      normalizedHistory.push(entry);
    }
  }

  return normalizedHistory
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
}

function normalizeEquippedBadgeIds(value: unknown): (string | null)[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return Array.from({ length: 3 }, (_, index) => {
    const badgeId = value[index];
    return typeof badgeId === "string" || badgeId === null ? badgeId : null;
  });
}

function normalizeDailyReflections(value: unknown): DailyReflection[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item): DailyReflection[] => {
      if (!isObject(item) || !isValidDateKey(item.date)) return [];
      const note = typeof item.note === "string" ? item.note.trim().slice(0, 280) : "";
      if (!note) return [];
      return [{
        date: item.date,
        note,
        updatedAt: safeString(item.updatedAt, new Date().toISOString()),
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

function normalizeRankPromotions(value: unknown): RankPromotionRecord[] {
  if (!Array.isArray(value)) return [];
  const rankNames = new Set<string>(DR_RANK_THRESHOLDS.map((rank) => rank.name));
  return value
    .filter(isObject)
    .flatMap((item) => {
      if (
        !rankNames.has(safeString(item.rank, "")) ||
        !rankNames.has(safeString(item.fromRank, "")) ||
        !isValidDateKey(item.date)
      ) {
        return [];
      }
      const rank = safeString(item.rank, "");
      return [{
        id: safeString(item.id, `promotion:${item.date}:${rank}`),
        date: item.date,
        unlockedAt: safeString(item.unlockedAt, `${item.date}T12:00:00.000Z`),
        fromRank: safeString(item.fromRank, "Foundation"),
        rank,
        drBefore: safeNumber(item.drBefore, 0),
        drAfter: safeNumber(item.drAfter, 0),
        drGained: safeNumber(item.drGained, 0),
        dayScore: safePercent(item.dayScore, 0),
        streak: safeNumber(item.streak, 0),
        strongestCategory: safeString(item.strongestCategory, "") || undefined,
        contractCompletedCount: safeNumber(item.contractCompletedCount, 0),
        contractTotalCount: safeNumber(item.contractTotalCount, 0),
      }];
    })
    .slice(-50);
}

export function buildStoredStateFromImport(value: Partial<StoredState>): StoredState {
  const today = localDateKey();
  const importedCategories = Array.isArray(value.categories)
    ? value.categories.map((category, index) =>
        normalizeCategory(category, defaultCategories[index] ?? defaultCategories[0])
      )
    : defaultCategories;
  const categories = importedCategories.length > 0 ? importedCategories : defaultCategories;
  const fallbackCategoryId = categories[0]?.id ?? defaultCategories[0].id;
  const categoryIds = new Set(categories.map((category) => category.id));

  const normalizedQuests = Array.isArray(value.quests)
    ? value.quests
        .map((quest) => normalizeQuest(quest, fallbackCategoryId, categoryIds))
        .filter((quest): quest is Quest => quest !== null)
    : defaultQuests;
  const seenQuestIds = new Set<string>();
  let activeContractCount = 0;
  const quests = normalizedQuests.map((quest, index) => {
    let id = quest.id;
    let duplicateIndex = index + 1;
    while (seenQuestIds.has(id)) {
      id = `${quest.id}-imported-${duplicateIndex}`;
      duplicateIndex += 1;
    }
    seenQuestIds.add(id);

    const canKeepContract = !quest.contract || quest.paused || activeContractCount < 3;
    if (quest.contract && !quest.paused && canKeepContract) activeContractCount += 1;
    return { ...quest, id, contract: canKeepContract ? quest.contract : false };
  });

  const archivedQuests = Array.isArray(value.archivedQuests)
    ? value.archivedQuests
        .map((quest) => normalizeArchivedQuest(quest, fallbackCategoryId, categoryIds))
        .filter((quest): quest is ArchivedQuest => quest !== null)
        .slice(0, 100)
    : [];

  const equippedBadgeIds = normalizeEquippedBadgeIds(value.equippedBadgeIds);

  return {
    categories,
    quests,
    disciplineRating: safeNumber(value.disciplineRating, defaultDisciplineRating),
    lastDrDelta:
      typeof value.lastDrDelta === "number" && Number.isFinite(value.lastDrDelta)
        ? Math.floor(value.lastDrDelta)
        : defaultLastDrDelta,
    lastCompletionPct: safePercent(value.lastCompletionPct, defaultLastCompletionPct),
    lastDrUpdateDate:
      value.lastDrUpdateDate === "" || isValidDateKey(value.lastDrUpdateDate)
        ? value.lastDrUpdateDate
        : defaultLastDrUpdateDate,
    drHistory: normalizeDrHistory(value.drHistory),
    lastResetDate: normalizeResetDateKey(value.lastResetDate, today),
    achievements: mergeAchievements(value.achievements),
    ...(equippedBadgeIds ? { equippedBadgeIds } : {}),
    lifetimeCompletedQuestCount: safeNumber(value.lifetimeCompletedQuestCount, 0),
    archivedQuests,
    dailyReflections: normalizeDailyReflections(value.dailyReflections),
    recoveryDays: normalizeRecoveryDays(value.recoveryDays),
    rankPromotions: normalizeRankPromotions(value.rankPromotions),
  };
}

function isStoredStateCandidate(value: unknown): value is Partial<StoredState> {
  if (!isObject(value)) return false;
  return Array.isArray(value.categories) || Array.isArray(value.quests);
}

export function parseImportPayload(value: unknown): ParsedImportPayload | null {
  if (isStoredStateCandidate(value)) {
    return {
      state: buildStoredStateFromImport(value),
    };
  }

  if (!isObject(value)) return null;
  const payload = value as Partial<DataExportPayload>;
  if (typeof payload.version !== "undefined" && payload.version !== 1) return null;
  if (typeof payload.storageKey !== "undefined" && payload.storageKey !== STORAGE_KEY) return null;
  if (!isStoredStateCandidate(payload.state)) return null;

  const parsed: ParsedImportPayload = {
    state: buildStoredStateFromImport(payload.state),
  };

  if (Array.isArray(payload.evaluationHistory)) {
    parsed.evaluationHistory = normalizeEvaluationHistory(payload.evaluationHistory);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "lastEvaluatedDate")) {
    parsed.lastEvaluatedDate =
      isValidDateKey(payload.lastEvaluatedDate)
        ? payload.lastEvaluatedDate
        : null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "reminders")) {
    parsed.reminders = normalizeReminderSettings(payload.reminders);
  }

  return parsed;
}
