import type { Quest } from "./types";

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
