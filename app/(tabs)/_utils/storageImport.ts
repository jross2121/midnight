import {
  defaultAchievements,
  defaultCategories,
  defaultDisciplineRating,
  defaultDrHistory,
  defaultLastCompletionPct,
  defaultLastDrDelta,
  defaultLastDrUpdateDate,
  defaultQuests,
} from "./defaultData";
import { localDateKey } from "./dateHelpers";
import { getQuestXpForDifficulty } from "./questXp";
import { normalizeQuestRepeat, normalizeScheduledWeekday } from "./recurrence";
import { normalizeReminderSettings, type ReminderSettings } from "./reminders";
import {
  STORAGE_KEY,
  type Achievement,
  type ArchivedQuest,
  type Category,
  type DrHistoryEntry,
  type Quest,
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
  evaluationHistory?: unknown[];
  lastEvaluatedDate?: string | null;
  reminders?: ReminderSettings;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function safeDateKey(value: unknown, fallback: string): string {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value) ? value : fallback;
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

function normalizeQuest(value: unknown, fallbackCategoryId: string): Quest | null {
  if (!isObject(value)) return null;

  const title = safeString(value.title, "");
  if (!title) return null;

  const difficulty = normalizeDifficulty(value.difficulty);
  const repeat = normalizeQuestRepeat(value.repeat);

  return {
    id: safeString(value.id, `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    title,
    categoryId: safeString(value.categoryId, fallbackCategoryId),
    xp: getQuestXpForDifficulty(difficulty),
    target: typeof value.target === "string" ? value.target : "",
    difficulty,
    repeat,
    scheduledWeekday:
      repeat === "weekly" ? normalizeScheduledWeekday(value.scheduledWeekday) : undefined,
    done: Boolean(value.done),
    pinned: Boolean(value.pinned),
    contract: Boolean(value.contract),
    paused: Boolean(value.paused),
  };
}

function normalizeArchivedQuest(value: unknown, fallbackCategoryId: string): ArchivedQuest | null {
  const quest = normalizeQuest(value, fallbackCategoryId);
  if (!quest || !isObject(value)) return null;

  return {
    ...quest,
    archivedAt:
      typeof value.archivedAt === "string" && value.archivedAt.trim().length > 0
        ? value.archivedAt
        : new Date().toISOString(),
  };
}

function normalizeAchievements(value: unknown): Achievement[] {
  const saved = Array.isArray(value) ? value : [];
  const savedById = new Map(
    saved
      .filter(isObject)
      .map((achievement) => [
        typeof achievement.id === "string" ? achievement.id : "",
        typeof achievement.unlockedAt === "string" ? achievement.unlockedAt : null,
      ])
  );

  return defaultAchievements.map((achievement) => ({
    ...achievement,
    unlockedAt: savedById.get(achievement.id) ?? achievement.unlockedAt,
  }));
}

function normalizeDrHistory(value: unknown): DrHistoryEntry[] {
  if (!Array.isArray(value)) return defaultDrHistory;

  const normalizedHistory: DrHistoryEntry[] = [];

  for (const rawEntry of value) {
    if (!isObject(rawEntry) || typeof rawEntry.date !== "string") continue;

    const entry: DrHistoryEntry = {
      date: safeDateKey(rawEntry.date, localDateKey()),
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

    normalizedHistory.push(entry);
  }

  return normalizedHistory.slice(-90);
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

  const quests = Array.isArray(value.quests)
    ? value.quests
        .map((quest) => normalizeQuest(quest, fallbackCategoryId))
        .filter((quest): quest is Quest => quest !== null)
    : defaultQuests;

  const archivedQuests = Array.isArray(value.archivedQuests)
    ? value.archivedQuests
        .map((quest) => normalizeArchivedQuest(quest, fallbackCategoryId))
        .filter((quest): quest is ArchivedQuest => quest !== null)
        .slice(0, 100)
    : [];

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
      typeof value.lastDrUpdateDate === "string" ? value.lastDrUpdateDate : defaultLastDrUpdateDate,
    drHistory: normalizeDrHistory(value.drHistory),
    lastResetDate: safeDateKey(value.lastResetDate, today),
    achievements: normalizeAchievements(value.achievements),
    lifetimeCompletedQuestCount: safeNumber(value.lifetimeCompletedQuestCount, 0),
    archivedQuests,
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
  if (!isStoredStateCandidate(payload.state)) return null;

  const parsed: ParsedImportPayload = {
    state: buildStoredStateFromImport(payload.state),
  };

  if (Array.isArray(payload.evaluationHistory)) {
    parsed.evaluationHistory = payload.evaluationHistory.filter(isObject).slice(-180);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "lastEvaluatedDate")) {
    parsed.lastEvaluatedDate =
      typeof payload.lastEvaluatedDate === "string" && DATE_KEY_PATTERN.test(payload.lastEvaluatedDate)
        ? payload.lastEvaluatedDate
        : null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "reminders")) {
    parsed.reminders = normalizeReminderSettings(payload.reminders);
  }

  return parsed;
}
