import type { DailyReflection } from "./types";

export function upsertDailyReflection(
  reflections: readonly DailyReflection[],
  date: string,
  note: string,
  updatedAt = new Date().toISOString()
): DailyReflection[] {
  const trimmedNote = note.trim();
  const withoutDate = reflections.filter((reflection) => reflection.date !== date);
  if (!trimmedNote) return withoutDate.slice(-29);

  return [
    ...withoutDate,
    { date, note: trimmedNote.slice(0, 280), updatedAt },
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

export function getLatestReflectionBefore(
  reflections: readonly DailyReflection[],
  date: string
): DailyReflection | null {
  return [...reflections]
    .filter((reflection) => reflection.date < date && reflection.note.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}
