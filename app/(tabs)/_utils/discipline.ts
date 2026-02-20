export const DAILY_STANDARD = 7;

export function getCompletionPercent(completed: number, dailyStandard: number = DAILY_STANDARD): number {
  if (dailyStandard <= 0 || completed <= 0) return 0;
  const boundedCompleted = Math.min(dailyStandard, Math.max(0, completed));
  const rawPercent = Math.round((boundedCompleted / dailyStandard) * 100);
  return Math.max(0, Math.min(100, rawPercent));
}

export function getDRChangeFromPercent(
  percent: number,
  totalQuests: number,
  dailyStandard: number = DAILY_STANDARD
): number {
  if (totalQuests <= 0 || dailyStandard <= 0) return -8;

  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  if (safePercent === 0) return -8;
  if (safePercent === 100) return +10;
  if (safePercent >= 85) return +7;
  if (safePercent >= 60) return +4;
  if (safePercent >= 30) return 0;
  return -4;
}

export function getCountdownToMidnight(now: Date = new Date()): string {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatSignedDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

export function formatDelta(delta: number): string {
  return formatSignedDelta(delta);
}

export const getDRDeltaFromPercent = getDRChangeFromPercent;

export const formatCountdownToMidnight = getCountdownToMidnight;
