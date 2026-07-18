export const REMINDER_ROUTES = ["/(tabs)", "/(tabs)/plan"] as const;

export type ReminderRoute = (typeof REMINDER_ROUTES)[number];
export type ReminderDestination = ReminderRoute | "/onboarding";

export type ReminderSlotSettings = {
  morningEnabled: boolean;
  contractEnabled: boolean;
  nextMoveEnabled: boolean;
};

export function getReminderRouteFromData(value: unknown): ReminderRoute | null {
  if (typeof value !== "object" || value === null) return null;
  const route = (value as { route?: unknown }).route;
  return REMINDER_ROUTES.includes(route as ReminderRoute)
    ? (route as ReminderRoute)
    : null;
}

export function getReminderDestinationFromData(
  value: unknown,
  hasCompletedOnboarding: boolean
): ReminderDestination | null {
  const route = getReminderRouteFromData(value);
  if (!route) return null;
  return hasCompletedOnboarding ? route : "/onboarding";
}

export function getEnabledReminderCount(settings: ReminderSlotSettings): number {
  return [
    settings.morningEnabled,
    settings.contractEnabled,
    settings.nextMoveEnabled,
  ].filter(Boolean).length;
}
