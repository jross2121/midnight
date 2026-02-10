import type { Streak } from "./types";

export function localDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function diffDays(a: string, b: string) {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function yesterdayKey(today: string) {
  const d = parseDateKey(today);
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function applyDayResult(
  streak: Streak,
  dayKey: string,
  success: boolean,
  gapFromLastReset: number
) {
  if (!success) return { ...streak, current: 0 };

  const broke = gapFromLastReset > 1;
  let nextCurrent = 1;

  if (!broke && streak.lastDate) {
    if (diffDays(streak.lastDate, dayKey) === 1) {
      nextCurrent = streak.current + 1;
    } else {
      nextCurrent = 1;
    }
  }

  const nextBest = Math.max(streak.best, nextCurrent);
  return { current: nextCurrent, best: nextBest, lastDate: dayKey };
}

export function liveStreak(
  streak: Streak,
  todayKeyStr: string,
  todaySuccess: boolean
) {
  if (!todaySuccess) return streak.current;

  if (streak.lastDate === todayKeyStr) return streak.current;

  const yKey = yesterdayKey(todayKeyStr);

  if (streak.lastDate === yKey) return streak.current + 1;

  return 1;
}
