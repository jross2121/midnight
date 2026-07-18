import { parseDateKey } from "./dateHelpers";
import { getScheduledQuestsForDate } from "./recurrence";
import type { Quest } from "./types";

export const MAX_ACTIVE_QUESTS_PER_DAY = 10;
export const QUEST_LIMIT_LOOKAHEAD_DAYS = 7;

export type QuestLimitConflict = {
  dateKey: string;
  totalCount: number;
  maxCount: number;
};

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getUpcomingDateKeys(
  startDateKey: string,
  days: number = QUEST_LIMIT_LOOKAHEAD_DAYS
): string[] {
  return Array.from({ length: days }, (_, index) => addDaysToDateKey(startDateKey, index));
}

export function findDailyQuestLimitConflict(
  quests: Quest[],
  dateKeys: string[],
  maxCount: number = MAX_ACTIVE_QUESTS_PER_DAY
): QuestLimitConflict | null {
  for (const dateKey of dateKeys) {
    const totalCount = getScheduledQuestsForDate(quests, dateKey).length;
    if (totalCount > maxCount) {
      return {
        dateKey,
        totalCount,
        maxCount,
      };
    }
  }

  return null;
}

export function formatQuestLimitDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
