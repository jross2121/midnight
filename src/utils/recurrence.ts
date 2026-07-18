import { isValidDateKey, parseDateKey } from "./dateHelpers";
import type { ArchivedQuest, Quest, QuestRepeat } from "./types";

export const QUEST_REPEAT_OPTIONS: QuestRepeat[] = ["once", "daily", "weekdays", "weekly"];

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function normalizeQuestRepeat(value: unknown): QuestRepeat {
  return value === "once" || value === "weekdays" || value === "weekly" ? value : "daily";
}

export function getWeekdayFromDateKey(dateKey: string): number {
  return parseDateKey(dateKey).getDay();
}

export function getTodayWeekday(): number {
  return new Date().getDay();
}

export function normalizeScheduledWeekday(value: unknown, fallback = getTodayWeekday()): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(6, Math.floor(value)));
}

export function getQuestRepeatLabel(quest: Pick<Quest, "repeat" | "scheduledWeekday" | "scheduledDate">): string {
  const repeat = normalizeQuestRepeat(quest.repeat);
  if (repeat === "once") {
    if (isValidDateKey(quest.scheduledDate)) {
      const dateLabel = parseDateKey(quest.scheduledDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `Once ${dateLabel}`;
    }
    return "Once";
  }
  if (repeat === "weekdays") return "Weekdays";
  if (repeat === "weekly") {
    const weekday = normalizeScheduledWeekday(quest.scheduledWeekday);
    return `Weekly ${WEEKDAY_LABELS[weekday]}`;
  }
  return "Daily";
}

export function isQuestScheduledForDate(quest: Quest, dateKey: string): boolean {
  if (quest.paused) return false;

  const repeat = normalizeQuestRepeat(quest.repeat);
  if (repeat === "once") {
    return isValidDateKey(quest.scheduledDate) ? quest.scheduledDate === dateKey : true;
  }
  if (repeat === "daily") return true;

  const weekday = getWeekdayFromDateKey(dateKey);
  if (repeat === "weekdays") return weekday >= 1 && weekday <= 5;

  return normalizeScheduledWeekday(quest.scheduledWeekday, weekday) === weekday;
}

export function getScheduledQuestsForDate(quests: Quest[], dateKey: string): Quest[] {
  return quests.filter((quest) => isQuestScheduledForDate(quest, dateKey));
}

export function normalizeQuestSchedule(quest: Quest, fallbackDateKey: string): Quest {
  const repeat = normalizeQuestRepeat(quest.repeat);
  const fallbackWeekday = getWeekdayFromDateKey(fallbackDateKey);

  return {
    ...quest,
    repeat,
    paused: Boolean(quest.paused),
    scheduledDate:
      repeat === "once" && isValidDateKey(quest.scheduledDate)
        ? quest.scheduledDate
        : undefined,
    scheduledWeekday:
      repeat === "weekly"
        ? normalizeScheduledWeekday(quest.scheduledWeekday, fallbackWeekday)
        : undefined,
  };
}

export function getCompletedOneTimeArchives(
  quests: Quest[],
  archivedAt: string
): ArchivedQuest[] {
  return quests
    .filter((quest) => normalizeQuestRepeat(quest.repeat) === "once" && quest.done)
    .map((quest) => ({
      ...quest,
      archivedAt,
    }));
}

export function rollQuestsForNewDay(quests: Quest[]): Quest[] {
  return quests
    .filter((quest) => !(normalizeQuestRepeat(quest.repeat) === "once" && quest.done))
    .map((quest) => ({ ...quest, done: false, completionReceipt: undefined }));
}
