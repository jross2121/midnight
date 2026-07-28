import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import {
  PLAN_TOUR_ELIGIBLE_KEY,
  PLAN_TOUR_STORAGE_KEY,
  TODAY_TOUR_ELIGIBLE_KEY,
  TODAY_TOUR_STORAGE_KEY,
} from "@/src/components/GuidedSpotlightTour";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "@/src/styles";
import { localDateKey } from "@/src/utils/dateHelpers";
import { defaultLastCompletionPct, defaultLastDrDelta, defaultLastDrUpdateDate } from "@/src/utils/defaultData";
import { withAlpha } from "@/src/utils/designSystem";
import {
  DAILY_EVALUATION_HISTORY_STORAGE_KEY,
  readEvaluationHistory,
} from "@/src/utils/evaluationHistory";
import { MIDNIGHT_EVALUATION_STORAGE_KEY } from "@/src/utils/midnightEvaluation";
import {
  findDailyQuestLimitConflict,
  formatQuestLimitDate,
  getUpcomingDateKeys,
} from "@/src/utils/questLimits";
import { getQuestXpForDifficulty } from "@/src/utils/questXp";
import { normalizeQuestRepeat, normalizeScheduledWeekday } from "@/src/utils/recurrence";
import {
  adjustReminderTime,
  DEFAULT_REMINDER_SETTINGS,
  formatReminderTime,
  getReminderPermissionStatus,
  loadReminderSettings,
  requestReminderPermissions,
  sendTestReminder,
  syncReminderSchedule,
  type ReminderPermissionStatus,
  type ReminderSettings,
} from "@/src/utils/reminders";
import { getEnabledReminderCount } from "@/src/utils/reminderLogic";
import {
  buildStoredStateFromImport,
  parseImportPayload,
  type DataExportPayload,
} from "@/src/utils/storageImport";
import {
  readStoredState,
  replaceStoredState,
  transactStoredState,
  updateStoredState,
} from "@/src/utils/storedState";
import { useTheme } from "@/src/utils/themeContext";
import {
  ONBOARDING_STORAGE_KEY,
  STORAGE_KEY,
  type ArchivedQuest,
  type Quest,
  type StoredState,
} from "@/src/utils/types";

const SETTINGS_ACCENT = HOME_GOLD;
const SETTINGS_BUTTON_TEXT = "#15131A";
const MIDNIGHT_MARK = require("../../assets/images/android-icon-foreground-v2.png");

function getYesterdayDateKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type ReminderEnabledKey = "morningEnabled" | "contractEnabled" | "nextMoveEnabled";
type ReminderHourKey = "morningHour" | "contractHour" | "nextMoveHour";
type ReminderMinuteKey = "morningMinute" | "contractMinute" | "nextMoveMinute";

function getReminderPermissionCopy(status: ReminderPermissionStatus) {
  if (status === "granted") return "Allowed";
  if (status === "denied") return "Blocked in device settings";
  return "Not requested";
}

function getAppVersionCopy() {
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const versionCode = Constants.expoConfig?.android?.versionCode;
  return versionCode ? `${version} (${versionCode})` : version;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme();
  const styles = createStyles(colors);
  const [archivedQuests, setArchivedQuests] = useState<ArchivedQuest[]>([]);
  const [exportPayload, setExportPayload] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [showImportBox, setShowImportBox] = useState(false);
  const [reminderSettings, setReminderSettings] =
    useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [reminderPermission, setReminderPermission] =
    useState<ReminderPermissionStatus>("undetermined");
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [reminderTesting, setReminderTesting] = useState(false);
  const [profileResetting, setProfileResetting] = useState(false);
  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/more");
  };
  const isLightTheme = theme === "light";
  const settingsDividerColor = isLightTheme ? "#E2E8F0" : "#1A2633";
  const settingsGoldBorder = isLightTheme ? "#F0C96E" : "#5B421B";
  const settingsCardSurface = {
    backgroundColor: withAlpha(colors.surface2, isLightTheme ? 0.82 : 0.9),
    borderColor: withAlpha(colors.border, isLightTheme ? 0.66 : 0.42),
  };
  const settingsFeatureSurface = {
    backgroundColor: withAlpha(colors.surface2, isLightTheme ? 0.82 : 0.9),
    borderColor: withAlpha(SETTINGS_ACCENT, isLightTheme ? 0.28 : 0.24),
  };
  const settingsInputSurface = {
    backgroundColor: withAlpha(colors.bg, isLightTheme ? 0.56 : 0.72),
    borderColor: withAlpha(colors.border, 0.72),
  };

  const loadArchive = useCallback(async () => {
    try {
      const storedState = await readStoredState();
      setArchivedQuests(storedState.archivedQuests);
    } catch (error) {
      if (__DEV__) console.warn("Failed to load quest archive:", error);
      setArchivedQuests([]);
    }
  }, []);

  const loadReminders = useCallback(async () => {
    const [settings, permission] = await Promise.all([
      loadReminderSettings(),
      getReminderPermissionStatus(),
    ]);
    setReminderSettings(settings);
    setReminderPermission(permission);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadArchive();
      loadReminders();
    }, [loadArchive, loadReminders])
  );

  const saveReminderUpdate = async (
    updater: (settings: ReminderSettings) => ReminderSettings
  ) => {
    if (remindersSaving) return;

    let nextSettings = updater(reminderSettings);
    setReminderSettings(nextSettings);
    setRemindersSaving(true);

    try {
      let permission = reminderPermission;

      if (nextSettings.enabled && permission !== "granted") {
        permission = await requestReminderPermissions();
        setReminderPermission(permission);

        if (permission !== "granted") {
          nextSettings = { ...nextSettings, enabled: false };
          setReminderSettings(nextSettings);
          Alert.alert(
            "Notifications are off",
            "Midnight can save reminder choices, but device notifications must be allowed before reminders can fire."
          );
        }
      }

      const syncedPermission = await syncReminderSchedule(nextSettings);
      setReminderPermission(syncedPermission);
    } catch (error) {
      if (__DEV__) console.warn("Failed to save reminders:", error);
      const savedSettings = await loadReminderSettings();
      setReminderSettings(savedSettings);
      Alert.alert("Reminder update failed", "Could not update your notification schedule.");
    } finally {
      setRemindersSaving(false);
    }
  };

  const toggleReminderMaster = () => {
    saveReminderUpdate((settings) => ({ ...settings, enabled: !settings.enabled }));
  };

  const testReminderDelivery = async () => {
    if (reminderTesting || remindersSaving) return;
    setReminderTesting(true);

    try {
      let permission = reminderPermission;
      if (permission !== "granted") {
        permission = await requestReminderPermissions();
        setReminderPermission(permission);
      }

      if (permission !== "granted") {
        Alert.alert(
          "Notifications are blocked",
          "Allow notifications in device settings, then return here and try again.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => void Linking.openSettings() },
          ]
        );
        return;
      }

      await sendTestReminder();
      Alert.alert(
        "Test reminder sent",
        "It should appear in a moment. Tap it to confirm that Midnight opens Today."
      );
    } catch (error) {
      if (__DEV__) console.warn("Failed to send test reminder:", error);
      Alert.alert("Test failed", "Midnight could not send a test notification on this device.");
    } finally {
      setReminderTesting(false);
    }
  };

  const toggleReminderSlot = (key: ReminderEnabledKey) => {
    saveReminderUpdate((settings) => ({ ...settings, [key]: !settings[key] }));
  };

  const shiftReminderTime = (
    hourKey: ReminderHourKey,
    minuteKey: ReminderMinuteKey,
    deltaMinutes: number
  ) => {
    saveReminderUpdate((settings) => {
      const nextTime = adjustReminderTime(settings[hourKey], settings[minuteKey], deltaMinutes);
      return {
        ...settings,
        [hourKey]: nextTime.hour,
        [minuteKey]: nextTime.minute,
      };
    });
  };

  const renderReminderRow = (
    title: string,
    description: string,
    enabledKey: ReminderEnabledKey,
    hourKey: ReminderHourKey,
    minuteKey: ReminderMinuteKey,
    tone = SETTINGS_ACCENT
  ) => {
    const enabled = reminderSettings[enabledKey];
    const time = formatReminderTime(reminderSettings[hourKey], reminderSettings[minuteKey]);
    const controlsDisabled = remindersSaving || !reminderSettings.enabled;
    const hasCustomTone = tone !== SETTINGS_ACCENT;

    return (
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: settingsDividerColor,
          paddingTop: 12,
          marginTop: 12,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { color: hasCustomTone ? tone : colors.textPrimary, fontSize: 14 }]}>
              {title}
            </Text>
            <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 4 }]}>
              {description}
            </Text>
          </View>
          <Pressable
            onPress={() => toggleReminderSlot(enabledKey)}
            disabled={remindersSaving}
            accessibilityRole="switch"
            accessibilityLabel={`${enabled ? "Disable" : "Enable"} ${title}`}
            accessibilityState={{ checked: enabled, disabled: remindersSaving }}
            style={({ pressed }) => [
              {
                alignSelf: "flex-start",
                backgroundColor: enabled ? tone : settingsInputSurface.backgroundColor,
                borderWidth: enabled ? 0 : 1,
                borderColor: settingsInputSurface.borderColor,
                borderRadius: 8,
                paddingVertical: 7,
                paddingHorizontal: 10,
                minHeight: 44,
                minWidth: 56,
                alignItems: "center",
                justifyContent: "center",
                opacity: remindersSaving ? 0.5 : pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: enabled ? SETTINGS_BUTTON_TEXT : colors.textSecondary,
                fontWeight: "900",
                fontSize: 11,
              }}
            >
              {enabled ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => shiftReminderTime(hourKey, minuteKey, -30)}
            disabled={controlsDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Move ${title} earlier`}
            accessibilityState={{ disabled: controlsDisabled }}
            hitSlop={5}
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: settingsInputSurface.borderColor,
                backgroundColor: settingsInputSurface.backgroundColor,
                opacity: controlsDisabled ? 0.42 : pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 16 }}>
              -
            </Text>
          </Pressable>
          <View
            style={{
              minWidth: 92,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: hasCustomTone ? withAlpha(tone, 0.28) : settingsInputSurface.borderColor,
              backgroundColor: hasCustomTone ? withAlpha(tone, 0.08) : settingsInputSurface.backgroundColor,
            }}
          >
            <Text style={{ color: hasCustomTone ? tone : colors.textPrimary, fontWeight: "900", fontSize: 13 }}>
              {time}
            </Text>
          </View>
          <Pressable
            onPress={() => shiftReminderTime(hourKey, minuteKey, 30)}
            disabled={controlsDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Move ${title} later`}
            accessibilityState={{ disabled: controlsDisabled }}
            hitSlop={5}
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: settingsInputSurface.borderColor,
                backgroundColor: settingsInputSurface.backgroundColor,
                opacity: controlsDisabled ? 0.42 : pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 16 }}>
              +
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const saveArchiveState = async (
    updater: (state: StoredState) => StoredState
  ) => {
    const nextState = await updateStoredState(updater);
    setArchivedQuests(nextState.archivedQuests);
  };

  const restoreArchivedQuest = async (questId: string) => {
    try {
      await saveArchiveState((state) => {
        const archive = Array.isArray(state.archivedQuests) ? state.archivedQuests : [];
        const archivedQuest = archive.find((quest) => quest.id === questId);
        if (!archivedQuest) return state;

        const activeQuests = Array.isArray(state.quests) ? state.quests : [];
        const activeContractCount = activeQuests.filter((quest) => quest.contract && !quest.paused).length;
        if (archivedQuest.contract && activeContractCount >= 3) {
          Alert.alert("Contract limit reached", "Remove another contract before restoring this quest.");
          return state;
        }

        const repeat = normalizeQuestRepeat(archivedQuest.repeat);
        const restoredQuest: Quest = {
          id: activeQuests.some((item) => item.id === archivedQuest.id)
            ? `${archivedQuest.id}-restored-${Date.now()}`
            : archivedQuest.id,
          title: archivedQuest.title,
          categoryId: archivedQuest.categoryId,
          xp: getQuestXpForDifficulty(archivedQuest.difficulty),
          target: archivedQuest.target,
          difficulty: archivedQuest.difficulty,
          repeat,
          scheduledWeekday:
            repeat === "weekly"
              ? normalizeScheduledWeekday(archivedQuest.scheduledWeekday)
              : undefined,
          pinned: false,
          contract: archivedQuest.contract,
          done: false,
          paused: false,
        };
        const conflict = findDailyQuestLimitConflict(
          [...activeQuests, restoredQuest],
          getUpcomingDateKeys(localDateKey())
        );
        if (conflict) {
          Alert.alert(
            "Daily quest limit",
            `${formatQuestLimitDate(conflict.dateKey)} would have ${conflict.totalCount}/${conflict.maxCount} active quests. Pause or archive another quest first.`
          );
          return state;
        }

        return {
          ...state,
          quests: [...activeQuests, restoredQuest],
          archivedQuests: archive.filter((item) => item.id !== questId),
        };
      });
    } catch (error) {
      if (__DEV__) console.warn("Failed to restore archived quest:", error);
      Alert.alert("Restore failed", "Could not move that quest back to today's queue.");
    }
  };

  const confirmClearArchive = () => {
    Alert.alert(
      "Clear archive?",
      "Archived quests will be permanently removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await saveArchiveState((state) => ({ ...state, archivedQuests: [] }));
            } catch (error) {
              if (__DEV__) console.warn("Failed to clear archive:", error);
              Alert.alert("Clear failed", "Could not clear the archive.");
            }
          },
        },
      ]
    );
  };

  const generateExportPayload = async () => {
    try {
      const [savedState, evaluationHistory, lastEvaluatedDate] = await Promise.all([
        readStoredState(),
        readEvaluationHistory(),
        AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY),
      ]);
      const savedReminders = await loadReminderSettings();

      const payload: DataExportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        storageKey: STORAGE_KEY,
        state: savedState,
        evaluationHistory,
        lastEvaluatedDate,
        reminders: savedReminders,
      };

      setExportPayload(JSON.stringify(payload, null, 2));
      Alert.alert("Export ready", "Your backup JSON is ready in the export box.");
    } catch (error) {
      if (__DEV__) console.warn("Failed to generate export payload:", error);
      Alert.alert("Export failed", "Could not build a clean backup from saved app data.");
    }
  };

  const importData = async () => {
    let backup: ReturnType<typeof parseImportPayload>;

    try {
      const parsed = JSON.parse(importPayload);
      backup = parseImportPayload(parsed);
    } catch (error) {
      if (__DEV__) console.warn("Failed to parse imported data:", error);
      Alert.alert("Import failed", "That text is not valid JSON. Paste a complete Midnight backup and try again.");
      return;
    }

    if (!backup) {
      Alert.alert("Import failed", "This is not a supported Midnight backup.");
      return;
    }

    try {
      await transactStoredState(() => ({
        state: backup.state,
        result: undefined,
        additionalEntries: [
          [
            DAILY_EVALUATION_HISTORY_STORAGE_KEY,
            JSON.stringify(backup.evaluationHistory ?? []),
          ],
          [MIDNIGHT_EVALUATION_STORAGE_KEY, backup.lastEvaluatedDate ?? ""],
        ],
      }));
    } catch (error) {
      if (__DEV__) console.warn("Failed to replace imported profile:", error);
      Alert.alert(
        "Import failed",
        "Your existing profile was not replaced. Check available device storage, then try again."
      );
      return;
    }

    let importedRemindersPaused = false;
    let importedRemindersFailed = false;

    if (backup.reminders) {
      try {
        let importedReminders = backup.reminders;
        let permission = reminderPermission;

        if (importedReminders.enabled && permission !== "granted") {
          permission = await requestReminderPermissions();
          setReminderPermission(permission);

          if (permission !== "granted") {
            importedReminders = { ...importedReminders, enabled: false };
            importedRemindersPaused = true;
          }
        }

        const syncedPermission = await syncReminderSchedule(importedReminders);
        setReminderSettings(importedReminders);
        setReminderPermission(syncedPermission);
      } catch (error) {
        importedRemindersFailed = true;
        if (__DEV__) console.warn("Profile imported but reminders could not be restored:", error);
        const [savedSettings, permission] = await Promise.all([
          loadReminderSettings(),
          getReminderPermissionStatus(),
        ]);
        setReminderSettings(savedSettings);
        setReminderPermission(permission);
      }
    }

    try {
      setImportPayload("");
      setShowImportBox(false);
      setExportPayload("");
      await loadArchive();
    } catch (error) {
      if (__DEV__) console.warn("Profile imported but Settings could not refresh:", error);
    }

    const profileCopy =
      "Your quests, progress, awards, archive, reflections, Recovery Days, and history were restored.";
    const importCompleteMessage = importedRemindersFailed
      ? `${profileCopy} Reminder scheduling could not be finished; review Reminders before relying on them.`
      : importedRemindersPaused
        ? `${profileCopy} Reminders were restored but left paused until notifications are allowed.`
        : backup.reminders
          ? `${profileCopy} Reminder settings were also restored.`
          : `${profileCopy} Your existing reminder settings were kept.`;
    Alert.alert(importedRemindersFailed ? "Profile restored; check reminders" : "Import complete", importCompleteMessage);
  };

  const confirmImportData = () => {
    if (importPayload.trim().length === 0) return;

    Alert.alert(
      "Import backup?",
      "This replaces saved quests, progress, awards, archive, reflections, Recovery Days, and history on this device. A full backup also replaces reminder settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Import", style: "destructive", onPress: importData },
      ]
    );
  };

  const resetProfile = async () => {
    if (profileResetting) return;
    setProfileResetting(true);
    try {
      const emptyState = buildStoredStateFromImport({});
      await replaceStoredState(emptyState);
      await AsyncStorage.multiRemove([
        MIDNIGHT_EVALUATION_STORAGE_KEY,
        DAILY_EVALUATION_HISTORY_STORAGE_KEY,
        ONBOARDING_STORAGE_KEY,
        TODAY_TOUR_STORAGE_KEY,
        TODAY_TOUR_ELIGIBLE_KEY,
        PLAN_TOUR_STORAGE_KEY,
        PLAN_TOUR_ELIGIBLE_KEY,
      ]);
      setArchivedQuests([]);
      setExportPayload("");
      setImportPayload("");
      setShowImportBox(false);
      Alert.alert(
        "Profile reset",
        "Your quests and progress were cleared. Appearance and reminder preferences were kept.",
        [{ text: "Start fresh", onPress: () => router.replace("/onboarding") }]
      );
    } catch (error) {
      if (__DEV__) console.warn("Failed to reset profile:", error);
      Alert.alert("Reset failed", "Midnight could not safely clear your profile.");
    } finally {
      setProfileResetting(false);
    }
  };

  const confirmResetProfile = () => {
    Alert.alert(
      "Reset Midnight profile?",
      "This permanently clears every quest, category level, XP total, Discipline Rating, award, equipped award, archive item, reflection, Recovery Day, and evaluation record on this device. This cannot be undone. Your theme and reminder preferences will remain.",
      [
        { text: "Keep profile", style: "cancel" },
        { text: "Reset everything", style: "destructive", onPress: resetProfile },
      ]
    );
  };

  const simulateMidnightEvaluation = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        Alert.alert("No saved profile", "Open Today once before running the simulation.");
        return;
      }

      const yesterday = getYesterdayDateKey();

      await updateStoredState((current) => ({
        ...current,
        lastResetDate: yesterday,
        lastDrDelta:
          typeof current.lastDrDelta === "number" ? current.lastDrDelta : defaultLastDrDelta,
        lastCompletionPct:
          typeof current.lastCompletionPct === "number"
            ? current.lastCompletionPct
            : defaultLastCompletionPct,
        lastDrUpdateDate:
          typeof current.lastDrUpdateDate === "string"
            ? current.lastDrUpdateDate
            : defaultLastDrUpdateDate,
      }));

      await AsyncStorage.removeItem(MIDNIGHT_EVALUATION_STORAGE_KEY);

      Alert.alert("Simulation armed", "Returning to Today will show Midnight Evaluation.");
      router.replace("/(tabs)");
    } catch (error) {
      if (__DEV__) console.warn("Failed to simulate midnight evaluation:", error);
      Alert.alert("Simulation failed", "Could not prepare pending evaluation state.");
    }
  };

  const reminderPermissionTone =
    reminderPermission === "granted"
      ? colors.positive
      : reminderPermission === "denied"
        ? colors.negative
      : colors.textSecondary;
  const enabledReminderCount = getEnabledReminderCount(reminderSettings);
  const importFieldVisible = showImportBox || importPayload.trim().length > 0;
  const importButtonDisabled = importFieldVisible && importPayload.trim().length === 0;
  const renderSettingsSectionLabel = (label: string, marginTop = 16) => (
    <View
      style={{
        marginTop,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <View style={{ width: 4, height: 18, borderRadius: 999, backgroundColor: SETTINGS_ACCENT }} />
      <Text
        style={{
          color: withAlpha(colors.textSecondary, 0.82),
          fontSize: 12,
          lineHeight: 17,
          fontWeight: "900",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );

  const renderSettingsCardHeader = (
    icon: React.ComponentProps<typeof IconSymbol>["name"],
    title: string,
    body: string,
    tone = SETTINGS_ACCENT
  ) => (
    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 11 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: withAlpha(tone, 0.28),
          backgroundColor: withAlpha(tone, 0.09),
          flexShrink: 0,
        }}
      >
        <IconSymbol name={icon} size={18} color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary, fontSize: 16, lineHeight: 20 }]}>
          {title}
        </Text>
        <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 3, lineHeight: 17 }]}>
          {body}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader
          title="Settings"
          subtitle="Shape how Midnight works for you"
          icon="chevron.left"
          onIconPress={navigateBack}
          iconAccessibilityLabel="Go back"
          style={{ marginBottom: 12 }}
        />

        <View
          style={[
            styles.card,
            settingsFeatureSurface,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 16,
              marginBottom: 6,
              backgroundColor: withAlpha(SETTINGS_ACCENT, 0.055),
            },
          ]}
        >
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: withAlpha(SETTINGS_ACCENT, 0.3),
              backgroundColor: withAlpha(SETTINGS_ACCENT, 0.08),
            }}
          >
            <Image source={MIDNIGHT_MARK} resizeMode="contain" style={{ width: 43, height: 43 }} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: SETTINGS_ACCENT, fontSize: 10, lineHeight: 14, fontWeight: "900", textTransform: "uppercase" }}>
              Your setup
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 19, lineHeight: 23, fontWeight: "900", marginTop: 1 }}>
              Midnight, tuned to you
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 3 }}>
              {theme === "dark" ? "Dark" : "Light"} theme · {reminderSettings.enabled ? `${enabledReminderCount} reminders active` : "Reminders paused"}
            </Text>
          </View>
        </View>

        {renderSettingsSectionLabel("Appearance", 0)}
        <View
          style={[
            styles.card,
            settingsFeatureSurface,
          ]}
        >
          <View style={[styles.cardTop, { alignItems: "center", gap: 12, marginBottom: 10 }]}>
            {renderSettingsCardHeader(
              "moon.fill",
              "Theme",
              `${theme === "dark" ? "Dark" : "Light"} mode is selected`
            )}
            <Pressable
              onPress={toggleTheme}
              accessibilityRole="switch"
              accessibilityLabel={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              accessibilityState={{ checked: theme === "dark" }}
              style={({ pressed }) => [
                {
                  backgroundColor: SETTINGS_ACCENT,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  minWidth: 72,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: SETTINGS_BUTTON_TEXT, fontWeight: "900", fontSize: 12 }}>
                {theme === "dark" ? "Light" : "Dark"}
              </Text>
            </Pressable>
          </View>
        </View>

        {renderSettingsSectionLabel("Notifications")}
        <View
          style={[
            styles.card,
            settingsFeatureSurface,
          ]}
        >
          <View style={[styles.cardTop, { alignItems: "center", gap: 12, marginBottom: 12 }]}>
            {renderSettingsCardHeader(
              "timer",
              "Reminders",
              "Plan your day and protect active Contracts"
            )}
            <Pressable
              onPress={toggleReminderMaster}
              disabled={remindersSaving}
              accessibilityRole="switch"
              accessibilityLabel={`${reminderSettings.enabled ? "Disable" : "Enable"} reminders`}
              accessibilityState={{ checked: reminderSettings.enabled, disabled: remindersSaving }}
              style={({ pressed }) => [
                {
                  backgroundColor: reminderSettings.enabled
                    ? SETTINGS_ACCENT
                    : settingsInputSurface.backgroundColor,
                  borderWidth: reminderSettings.enabled ? 0 : 1,
                  borderColor: settingsInputSurface.borderColor,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  minWidth: 78,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: remindersSaving ? 0.5 : pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: reminderSettings.enabled ? SETTINGS_BUTTON_TEXT : colors.textSecondary,
                  fontWeight: "900",
                  fontSize: 12,
                }}
              >
                {reminderSettings.enabled ? "Enabled" : "Enable"}
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: settingsDividerColor,
              borderRadius: 10,
              backgroundColor: withAlpha(colors.bg, isLightTheme ? 0.35 : 0.28),
              paddingHorizontal: 11,
              paddingVertical: 10,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: reminderPermissionTone }} />
              <Text style={[styles.questMeta, { color: colors.textSecondary, fontWeight: "800" }]}>
                Device permission
              </Text>
              <Text style={[styles.questMeta, { color: reminderPermissionTone, fontWeight: "900", marginLeft: "auto" }]}>
                {getReminderPermissionCopy(reminderPermission)}
              </Text>
            </View>
            <Text style={[styles.questMeta, { color: colors.textSecondary, lineHeight: 17 }]}>
              {reminderSettings.enabled
                ? enabledReminderCount > 0
                  ? `${enabledReminderCount} daily reminder${enabledReminderCount === 1 ? "" : "s"} active on this device.`
                  : "Reminders are on, but every time slot is disabled."
                : "Your times are saved. Turn reminders on when you are ready."}
            </Text>
          </View>

          <Pressable
            onPress={testReminderDelivery}
            disabled={reminderTesting || remindersSaving}
            accessibilityRole="button"
            accessibilityLabel="Send a test Midnight reminder"
            accessibilityHint="Sends a notification that opens the Today screen"
            style={({ pressed }) => [
              {
                alignSelf: "flex-start",
                minHeight: 44,
                marginTop: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: settingsGoldBorder,
                backgroundColor: withAlpha(SETTINGS_ACCENT, 0.08),
                paddingHorizontal: 13,
                alignItems: "center",
                justifyContent: "center",
                opacity: reminderTesting || remindersSaving ? 0.5 : pressed ? 0.76 : 1,
              },
            ]}
          >
            <Text style={{ color: SETTINGS_ACCENT, fontSize: 12, fontWeight: "900" }}>
              {reminderTesting ? "Sending…" : "Send test reminder"}
            </Text>
          </Pressable>

          {renderReminderRow(
            "Morning plan",
            "Start the day with a clean quest board. Opens Plan.",
            "morningEnabled",
            "morningHour",
            "morningMinute"
          )}
          {renderReminderRow(
            "Contract warning",
            "Catch contract quests before the day resets. Opens Today.",
            "contractEnabled",
            "contractHour",
            "contractMinute",
            CONTRACT_GOLD
          )}
          {renderReminderRow(
            "Next move",
            "A midday nudge when momentum needs help. Opens Today.",
            "nextMoveEnabled",
            "nextMoveHour",
            "nextMoveMinute"
          )}
        </View>

        {renderSettingsSectionLabel("Info")}
        <View
          style={[
            styles.card,
            settingsCardSurface,
          ]}
        >
          {renderSettingsCardHeader(
            "sparkles",
            "About Midnight",
            `Version ${getAppVersionCopy()}`
          )}
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            A daily discipline tracker focused on consistency, accountability, and measurable progress.
          </Text>
        </View>

        {renderSettingsSectionLabel("Device data")}
        <View
          style={[
            styles.card,
            settingsCardSurface,
          ]}
        >
          {renderSettingsCardHeader(
            "shield.fill",
            "Data & privacy",
            "Your Midnight data stays under your control"
          )}
          <View style={{ gap: 8, marginTop: 13 }}>
            {[
              "Quests, progress, notes, and settings stay on this device.",
              "No account, ads, analytics SDK, or server sync.",
              "Backups are manual and remain under your control.",
            ].map((item) => (
              <View key={item} style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 1,
                    borderRadius: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: withAlpha(SETTINGS_ACCENT, 0.1),
                  }}
                >
                  <IconSymbol name="checkmark" size={12} color={SETTINGS_ACCENT} />
                </View>
                <Text style={[styles.questMeta, { flex: 1, color: colors.textSecondary, lineHeight: 18 }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.card,
            settingsCardSurface,
            { marginTop: 16 },
          ]}
        >
          <View style={[styles.cardTop, { alignItems: "center", gap: 12, marginBottom: 10 }]}>
            {renderSettingsCardHeader(
              "archivebox.fill",
              "Quest archive",
              `${archivedQuests.length} stored quest${archivedQuests.length === 1 ? "" : "s"}`
            )}
            {archivedQuests.length > 0 ? (
              <Pressable
                onPress={confirmClearArchive}
                accessibilityRole="button"
                accessibilityLabel="Clear quest archive"
                style={({ pressed }) => [
                  {
                    borderWidth: 1,
                    borderColor: settingsGoldBorder,
                    borderRadius: 8,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    minHeight: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{ color: SETTINGS_ACCENT, fontWeight: "900", fontSize: 11 }}>
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>

          {archivedQuests.length === 0 ? (
            <Text style={[styles.questMeta, { color: colors.textSecondary }]}>
              Archived quests will appear here when you move them out of the queue.
            </Text>
          ) : (
            archivedQuests.slice(0, 5).map((quest) => (
              <View
                key={`${quest.id}-${quest.archivedAt}`}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: settingsDividerColor,
                  paddingTop: 10,
                  marginTop: 10,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary, fontSize: 14 }]}>
                      {quest.title}
                    </Text>
                    <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 3 }]}>
                      {quest.xp} XP - archived {new Date(quest.archivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => restoreArchivedQuest(quest.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${quest.title}`}
                    style={({ pressed }) => [
                      {
                        backgroundColor: SETTINGS_ACCENT,
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        minHeight: 44,
                        justifyContent: "center",
                        alignSelf: "center",
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: SETTINGS_BUTTON_TEXT, fontWeight: "900", fontSize: 11 }}>
                      Restore
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View
          style={[
            styles.card,
            settingsCardSurface,
            { marginTop: 16 },
          ]}
        >
          {renderSettingsCardHeader(
            "paperplane.fill",
            "Backup & restore",
            "Move your Midnight data with a JSON backup"
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={generateExportPayload}
              accessibilityRole="button"
              accessibilityLabel="Generate export backup"
              style={({ pressed }) => [
                {
                  backgroundColor: SETTINGS_ACCENT,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  minHeight: 44,
                  justifyContent: "center",
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={{ color: SETTINGS_BUTTON_TEXT, fontWeight: "900", fontSize: 12 }}>
                Generate export
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!importFieldVisible) {
                  setShowImportBox(true);
                  return;
                }
                confirmImportData();
              }}
              disabled={importButtonDisabled}
              accessibilityRole="button"
              accessibilityLabel="Import backup"
              accessibilityState={{ disabled: importButtonDisabled }}
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: settingsGoldBorder,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  minHeight: 44,
                  justifyContent: "center",
                  opacity: importButtonDisabled ? 0.46 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={{ color: SETTINGS_ACCENT, fontWeight: "900", fontSize: 12 }}>
                {importFieldVisible ? "Import backup" : "Paste import"}
              </Text>
            </Pressable>
          </View>
          {exportPayload ? (
            <TextInput
              value={exportPayload}
              onChangeText={setExportPayload}
              placeholder="Generated export appears here"
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Generated backup JSON"
              style={{
                minHeight: 118,
                marginTop: 12,
                borderWidth: 1,
                borderColor: settingsInputSurface.borderColor,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 9,
                color: colors.textPrimary,
                backgroundColor: settingsInputSurface.backgroundColor,
                fontSize: 12,
                lineHeight: 16,
                fontFamily: "monospace",
              }}
            />
          ) : null}
          {importFieldVisible ? (
            <TextInput
              value={importPayload}
              onChangeText={setImportPayload}
              placeholder="Paste backup JSON to import"
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Backup JSON to import"
              style={{
                minHeight: 118,
                marginTop: 10,
                borderWidth: 1,
                borderColor: settingsInputSurface.borderColor,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 9,
                color: colors.textPrimary,
                backgroundColor: settingsInputSurface.backgroundColor,
                fontSize: 12,
                lineHeight: 16,
                fontFamily: "monospace",
              }}
            />
          ) : null}
        </View>

        {renderSettingsSectionLabel("Recovery")}
        <View
          style={[
            styles.card,
            settingsCardSurface,
            { borderColor: withAlpha(colors.negative, 0.38) },
          ]}
        >
          {renderSettingsCardHeader(
            "trash.fill",
            "Reset profile",
            "Erase this device and return to a new profile",
            colors.negative
          )}
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 10, lineHeight: 18 }]}>
            This clears every quest and all progress. Export a backup first if you may want the data later.
          </Text>
          <Pressable
            onPress={confirmResetProfile}
            disabled={profileResetting}
            accessibilityRole="button"
            accessibilityLabel="Reset all profile data"
            accessibilityState={{ disabled: profileResetting }}
            style={({ pressed }) => [
              {
                alignSelf: "flex-start",
                minHeight: 44,
                marginTop: 12,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: withAlpha(colors.negative, 0.52),
                backgroundColor: withAlpha(colors.negative, 0.1),
                alignItems: "center",
                justifyContent: "center",
                opacity: profileResetting ? 0.46 : pressed ? 0.76 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.negative, fontWeight: "900", fontSize: 12 }}>
              {profileResetting ? "Resetting…" : "Reset profile"}
            </Text>
          </Pressable>
        </View>

        {__DEV__ ? (
          <>
            {renderSettingsSectionLabel("Developer")}
            <View
              style={[
                styles.card,
                settingsCardSurface,
              ]}
            >
              {renderSettingsCardHeader(
                "gearshape.fill",
                "Developer tools",
                "Test evaluation behavior without changing device date"
              )}
              <Pressable
                onPress={simulateMidnightEvaluation}
                accessibilityRole="button"
                accessibilityLabel="Simulate midnight evaluation"
                style={({ pressed }) => [
                  {
                    marginTop: 12,
                    backgroundColor: SETTINGS_ACCENT,
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    minHeight: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.82 : 1,
                    alignSelf: "flex-start",
                  },
                ]}
              >
                <Text style={{ color: SETTINGS_BUTTON_TEXT, fontWeight: "900", fontSize: 12 }}>
                  Simulate Midnight Evaluation
                </Text>
              </Pressable>
              <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>Today: {localDateKey()} | Simulated day: {getYesterdayDateKey()}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
