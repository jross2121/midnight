import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const REMINDER_SETTINGS_STORAGE_KEY = "midnight:reminders:v1";
const REMINDER_SCHEDULE_STORAGE_KEY = "midnight:reminder-schedule:v1";
const REMINDER_CHANNEL_ID = "midnight-reminders";

export type ReminderPermissionStatus = "granted" | "denied" | "undetermined";

export type ReminderSettings = {
  enabled: boolean;
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  contractEnabled: boolean;
  contractHour: number;
  contractMinute: number;
  nextMoveEnabled: boolean;
  nextMoveHour: number;
  nextMoveMinute: number;
};

type ReminderScheduleState = {
  notificationIds: string[];
};

type ReminderConfig = {
  enabled: boolean;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  morningEnabled: true,
  morningHour: 8,
  morningMinute: 0,
  contractEnabled: true,
  contractHour: 21,
  contractMinute: 0,
  nextMoveEnabled: false,
  nextMoveHour: 14,
  nextMoveMinute: 0,
};

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function clampHour(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(23, Math.floor(value)));
}

function clampMinute(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(59, Math.floor(value)));
}

export function normalizeReminderSettings(value: unknown): ReminderSettings {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Partial<ReminderSettings>)
      : {};

  return {
    enabled:
      typeof candidate.enabled === "boolean"
        ? candidate.enabled
        : DEFAULT_REMINDER_SETTINGS.enabled,
    morningEnabled:
      typeof candidate.morningEnabled === "boolean"
        ? candidate.morningEnabled
        : DEFAULT_REMINDER_SETTINGS.morningEnabled,
    morningHour: clampHour(candidate.morningHour, DEFAULT_REMINDER_SETTINGS.morningHour),
    morningMinute: clampMinute(candidate.morningMinute, DEFAULT_REMINDER_SETTINGS.morningMinute),
    contractEnabled:
      typeof candidate.contractEnabled === "boolean"
        ? candidate.contractEnabled
        : DEFAULT_REMINDER_SETTINGS.contractEnabled,
    contractHour: clampHour(candidate.contractHour, DEFAULT_REMINDER_SETTINGS.contractHour),
    contractMinute: clampMinute(candidate.contractMinute, DEFAULT_REMINDER_SETTINGS.contractMinute),
    nextMoveEnabled:
      typeof candidate.nextMoveEnabled === "boolean"
        ? candidate.nextMoveEnabled
        : DEFAULT_REMINDER_SETTINGS.nextMoveEnabled,
    nextMoveHour: clampHour(candidate.nextMoveHour, DEFAULT_REMINDER_SETTINGS.nextMoveHour),
    nextMoveMinute: clampMinute(candidate.nextMoveMinute, DEFAULT_REMINDER_SETTINGS.nextMoveMinute),
  };
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_STORAGE_KEY);
    return normalizeReminderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings) {
  await AsyncStorage.setItem(
    REMINDER_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeReminderSettings(settings))
  );
}

function toReminderPermissionStatus(status: Notifications.PermissionStatus): ReminderPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return "granted";
  if (status === Notifications.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

export async function getReminderPermissionStatus(): Promise<ReminderPermissionStatus> {
  const permissions = await Notifications.getPermissionsAsync();
  return toReminderPermissionStatus(permissions.status);
}

export async function requestReminderPermissions(): Promise<ReminderPermissionStatus> {
  const permissions = await Notifications.requestPermissionsAsync();
  return toReminderPermissionStatus(permissions.status);
}

async function ensureReminderChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Midnight reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    description: "Daily planning and contract reminders from Midnight.",
    vibrationPattern: [0, 220, 120, 220],
    enableVibrate: true,
    showBadge: false,
  });
}

async function readScheduleState(): Promise<ReminderScheduleState> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_SCHEDULE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ReminderScheduleState>) : {};
    return {
      notificationIds: Array.isArray(parsed.notificationIds)
        ? parsed.notificationIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { notificationIds: [] };
  }
}

async function writeScheduleState(notificationIds: string[]) {
  await AsyncStorage.setItem(
    REMINDER_SCHEDULE_STORAGE_KEY,
    JSON.stringify({ notificationIds })
  );
}

export async function cancelReminderSchedule() {
  const schedule = await readScheduleState();
  await Promise.all(
    schedule.notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );
  await writeScheduleState([]);
}

async function scheduleDailyReminder(config: ReminderConfig): Promise<string | null> {
  if (!config.enabled) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: config.title,
      body: config.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: config.hour,
      minute: config.minute,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

export async function syncReminderSchedule(
  settings: ReminderSettings
): Promise<ReminderPermissionStatus> {
  const normalized = normalizeReminderSettings(settings);
  await saveReminderSettings(normalized);
  await cancelReminderSchedule();

  const permissionStatus = await getReminderPermissionStatus();
  if (!normalized.enabled || permissionStatus !== "granted") {
    return permissionStatus;
  }

  await ensureReminderChannel();

  const notificationIds = (
    await Promise.all([
      scheduleDailyReminder({
        enabled: normalized.morningEnabled,
        hour: normalized.morningHour,
        minute: normalized.morningMinute,
        title: "Plan today's run",
        body: "Pick the smallest first move and keep the board under control.",
      }),
      scheduleDailyReminder({
        enabled: normalized.contractEnabled,
        hour: normalized.contractHour,
        minute: normalized.contractMinute,
        title: "Contract check",
        body: "Protect your contract quests before midnight.",
      }),
      scheduleDailyReminder({
        enabled: normalized.nextMoveEnabled,
        hour: normalized.nextMoveHour,
        minute: normalized.nextMoveMinute,
        title: "Next move",
        body: "Clear one active quest before the day gets heavier.",
      }),
    ])
  ).filter((id): id is string => typeof id === "string");

  await writeScheduleState(notificationIds);
  return permissionStatus;
}

export function formatReminderTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(clampHour(hour, 0), clampMinute(minute, 0), 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function adjustReminderTime(
  hour: number,
  minute: number,
  deltaMinutes: number
): { hour: number; minute: number } {
  const totalMinutes = ((hour * 60 + minute + deltaMinutes) % 1440 + 1440) % 1440;
  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}
