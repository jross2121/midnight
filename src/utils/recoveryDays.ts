import { diffDays, isValidDateKey, offsetDateKey } from "./dateHelpers";

export const RECOVERY_DAY_COOLDOWN_DAYS = 7;

export type RecoveryDayStatus = {
  armed: boolean;
  available: boolean;
  lastRecoveryDate: string | null;
  nextAvailableDate: string | null;
};

export function normalizeRecoveryDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.filter((date): date is string => isValidDateKey(date)))
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(-30);
}

export function getRecoveryDayStatus(
  recoveryDays: readonly string[],
  dateKey: string
): RecoveryDayStatus {
  const normalized = normalizeRecoveryDays(recoveryDays);
  const armed = normalized.includes(dateKey);
  const earlierRecoveryDays = normalized.filter((date) => date < dateKey);
  const lastRecoveryDate = earlierRecoveryDays[earlierRecoveryDays.length - 1] ?? null;
  const daysSinceRecovery = lastRecoveryDate
    ? diffDays(lastRecoveryDate, dateKey)
    : Number.POSITIVE_INFINITY;
  const available = armed || daysSinceRecovery >= RECOVERY_DAY_COOLDOWN_DAYS;

  return {
    armed,
    available,
    lastRecoveryDate,
    nextAvailableDate:
      !available && lastRecoveryDate
        ? offsetDateKey(lastRecoveryDate, RECOVERY_DAY_COOLDOWN_DAYS)
        : null,
  };
}

export function setRecoveryDayArmed(
  recoveryDays: readonly string[],
  dateKey: string,
  armed: boolean
): string[] {
  const normalized = normalizeRecoveryDays(recoveryDays);
  if (!armed) return normalized.filter((date) => date !== dateKey);
  if (!getRecoveryDayStatus(normalized, dateKey).available) return normalized;
  return normalizeRecoveryDays([...normalized, dateKey]);
}
