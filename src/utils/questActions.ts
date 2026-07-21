import type { Quest } from "./types";
import { isQuestScheduledForDate, normalizeQuestRepeat } from "./recurrence";

export type TomorrowQuestAction = "copy" | "move" | null;

export function getTomorrowQuestAction(
  quest: Quest,
  tomorrowDateKey: string
): TomorrowQuestAction {
  const repeat = normalizeQuestRepeat(quest.repeat);

  if (repeat === "once") {
    return quest.done ? "copy" : "move";
  }

  return isQuestScheduledForDate(quest, tomorrowDateKey) ? null : "copy";
}

export function moveQuestToDate(quest: Quest, scheduledDate: string): Quest {
  return {
    ...quest,
    repeat: "once",
    scheduledWeekday: undefined,
    scheduledDate,
    done: false,
    completionReceipt: undefined,
  };
}

export function createQuestDuplicate(
  quest: Quest,
  id: string,
  scheduledDate?: string
): Quest {
  const scheduleForDate = typeof scheduledDate === "string" && scheduledDate.length > 0;

  return {
    ...quest,
    id,
    title: quest.title,
    repeat: scheduleForDate ? "once" : quest.repeat,
    scheduledWeekday: scheduleForDate ? undefined : quest.scheduledWeekday,
    scheduledDate: scheduleForDate ? scheduledDate : quest.scheduledDate,
    done: false,
    pinned: false,
    contract: false,
    paused: false,
    completionReceipt: undefined,
  };
}
