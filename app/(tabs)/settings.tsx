import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Footer } from "./_components/Footer";
import { createStyles } from "./_styles";
import { localDateKey } from "./_utils/dateHelpers";
import { defaultLastCompletionPct, defaultLastDrDelta, defaultLastDrUpdateDate } from "./_utils/defaultData";
import { DAILY_EVALUATION_HISTORY_STORAGE_KEY } from "./_utils/evaluationHistory";
import { MIDNIGHT_EVALUATION_STORAGE_KEY } from "./_utils/midnightEvaluation";
import { getQuestXpForDifficulty } from "./_utils/questXp";
import { parseImportPayload, type DataExportPayload } from "./_utils/storageImport";
import { useTheme } from "./_utils/themeContext";
import { STORAGE_KEY, type ArchivedQuest, type Quest, type StoredState } from "./_utils/types";

function getYesterdayDateKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme();
  const styles = createStyles(colors);
  const [archivedQuests, setArchivedQuests] = useState<ArchivedQuest[]>([]);
  const [exportPayload, setExportPayload] = useState("");
  const [importPayload, setImportPayload] = useState("");

  const loadArchive = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setArchivedQuests([]);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredState>;
      setArchivedQuests(Array.isArray(parsed.archivedQuests) ? parsed.archivedQuests : []);
    } catch (error) {
      console.log("Failed to load quest archive:", error);
      setArchivedQuests([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadArchive();
    }, [loadArchive])
  );

  const saveArchiveState = async (
    updater: (state: Partial<StoredState>) => Partial<StoredState>
  ) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
    const nextState = updater(parsed);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    setArchivedQuests(Array.isArray(nextState.archivedQuests) ? nextState.archivedQuests : []);
  };

  const restoreArchivedQuest = async (questId: string) => {
    try {
      await saveArchiveState((state) => {
        const archive = Array.isArray(state.archivedQuests) ? state.archivedQuests : [];
        const archivedQuest = archive.find((quest) => quest.id === questId);
        if (!archivedQuest) return state;

        const activeQuests = Array.isArray(state.quests) ? state.quests : [];
        const restoredQuest: Quest = {
          id: activeQuests.some((item) => item.id === archivedQuest.id)
            ? `${archivedQuest.id}-restored-${Date.now()}`
            : archivedQuest.id,
          title: archivedQuest.title,
          categoryId: archivedQuest.categoryId,
          xp: getQuestXpForDifficulty(archivedQuest.difficulty),
          target: archivedQuest.target,
          difficulty: archivedQuest.difficulty,
          repeat: archivedQuest.repeat,
          scheduledWeekday: archivedQuest.scheduledWeekday,
          pinned: archivedQuest.pinned,
          contract: archivedQuest.contract,
          done: false,
        };

        return {
          ...state,
          quests: [...activeQuests, restoredQuest],
          archivedQuests: archive.filter((item) => item.id !== questId),
        };
      });
    } catch (error) {
      console.log("Failed to restore archived quest:", error);
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
              console.log("Failed to clear archive:", error);
              Alert.alert("Clear failed", "Could not clear the archive.");
            }
          },
        },
      ]
    );
  };

  const generateExportPayload = async () => {
    try {
      const [rawState, rawEvaluationHistory, lastEvaluatedDate] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(DAILY_EVALUATION_HISTORY_STORAGE_KEY),
        AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY),
      ]);

      const payload: DataExportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        storageKey: STORAGE_KEY,
        state: rawState ? (JSON.parse(rawState) as Partial<StoredState>) : null,
        evaluationHistory: rawEvaluationHistory ? (JSON.parse(rawEvaluationHistory) as unknown[]) : null,
        lastEvaluatedDate,
      };

      setExportPayload(JSON.stringify(payload, null, 2));
      Alert.alert("Export ready", "Your backup JSON is ready in the export box.");
    } catch (error) {
      console.log("Failed to generate export payload:", error);
      Alert.alert("Export failed", "Could not build a clean backup from saved app data.");
    }
  };

  const importData = async () => {
    try {
      const parsed = JSON.parse(importPayload);
      const backup = parseImportPayload(parsed);

      if (!backup) {
        Alert.alert("Import failed", "Paste a valid Midnight backup JSON before importing.");
        return;
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(backup.state));

      if (Array.isArray(backup.evaluationHistory)) {
        await AsyncStorage.setItem(
          DAILY_EVALUATION_HISTORY_STORAGE_KEY,
          JSON.stringify(backup.evaluationHistory)
        );
      }

      if (typeof backup.lastEvaluatedDate === "string") {
        await AsyncStorage.setItem(MIDNIGHT_EVALUATION_STORAGE_KEY, backup.lastEvaluatedDate);
      } else if (backup.lastEvaluatedDate === null) {
        await AsyncStorage.removeItem(MIDNIGHT_EVALUATION_STORAGE_KEY);
      }

      setImportPayload("");
      setExportPayload("");
      await loadArchive();
      Alert.alert("Import complete", "Your saved quests, stats, archive, and history were restored.");
    } catch (error) {
      console.log("Failed to import data:", error);
      Alert.alert("Import failed", "Could not read that JSON backup.");
    }
  };

  const simulateMidnightEvaluation = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        Alert.alert("No saved profile", "Open Home once before running the simulation.");
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const yesterday = getYesterdayDateKey();

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...parsed,
          lastResetDate: yesterday,
          lastDrDelta:
            typeof parsed.lastDrDelta === "number" ? parsed.lastDrDelta : defaultLastDrDelta,
          lastCompletionPct:
            typeof parsed.lastCompletionPct === "number"
              ? parsed.lastCompletionPct
              : defaultLastCompletionPct,
          lastDrUpdateDate:
            typeof parsed.lastDrUpdateDate === "string"
              ? parsed.lastDrUpdateDate
              : defaultLastDrUpdateDate,
        })
      );

      await AsyncStorage.removeItem(MIDNIGHT_EVALUATION_STORAGE_KEY);

      Alert.alert("Simulation armed", "Returning to Home will show Midnight Evaluation.");
      router.replace("/(tabs)");
    } catch (error) {
      console.log("Failed to simulate midnight evaluation:", error);
      Alert.alert("Simulation failed", "Could not prepare pending evaluation state.");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <IconSymbol name="gearshape.fill" size={36} color={colors.accentPrimary} />
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Theme Section */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Theme
            </Text>
            <Pressable
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accentPrimary,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 12 }}>
                {theme === "dark" ? "Light" : "Dark"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.questMeta, { color: colors.textSecondary }]}>
            Current: <Text style={{ fontWeight: "700" }}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</Text>
          </Text>
        </View>

        {/* About Section */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            About
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 10 }]}>
            Midnight v1.0
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            Daily Discipline Tracker focused on consistency, accountability, and measurable progress.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Data & Privacy
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 10 }]}>
            Midnight stores quests, stats, awards, archive, and theme settings on this device.
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            This build does not use accounts, ads, analytics SDKs, or server sync.
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            Backup export is manual. Anything you copy from the export box is controlled by you.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <View style={styles.cardTop}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Quest Archive
              </Text>
              <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 6 }]}>
                {archivedQuests.length} stored quest{archivedQuests.length === 1 ? "" : "s"}
              </Text>
            </View>
            {archivedQuests.length > 0 ? (
              <Pressable
                onPress={confirmClearArchive}
                accessibilityRole="button"
                accessibilityLabel="Clear quest archive"
                style={({ pressed }) => [
                  {
                    borderWidth: 1,
                    borderColor: colors.accentPrimary,
                    borderRadius: 8,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.accentPrimary, fontWeight: "900", fontSize: 11 }}>
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
                  borderTopColor: colors.border,
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
                        backgroundColor: colors.accentPrimary,
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        alignSelf: "center",
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 11 }}>
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
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Data Portability
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            Export a JSON backup or import one to restore this device.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={generateExportPayload}
              accessibilityRole="button"
              accessibilityLabel="Generate export backup"
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accentPrimary,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 12 }}>
                Generate Export
              </Text>
            </Pressable>
            <Pressable
              onPress={importData}
              disabled={importPayload.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Import backup"
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: colors.accentPrimary,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  opacity: importPayload.trim().length === 0 ? 0.46 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.accentPrimary, fontWeight: "900", fontSize: 12 }}>
                Import Backup
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={exportPayload}
            onChangeText={setExportPayload}
            placeholder="Generated export appears here"
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              minHeight: 118,
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 9,
              color: colors.textPrimary,
              backgroundColor: colors.surface2,
              fontSize: 12,
              lineHeight: 16,
              fontFamily: "monospace",
            }}
          />
          <TextInput
            value={importPayload}
            onChangeText={setImportPayload}
            placeholder="Paste backup JSON to import"
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              minHeight: 118,
              marginTop: 10,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 9,
              color: colors.textPrimary,
              backgroundColor: colors.surface2,
              fontSize: 12,
              lineHeight: 16,
              fontFamily: "monospace",
            }}
          />
        </View>

        {__DEV__ ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginTop: 16,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Developer Tools</Text>
            <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>Run Midnight Evaluation without changing device date.</Text>
            <Pressable
              onPress={simulateMidnightEvaluation}
              accessibilityRole="button"
              accessibilityLabel="Simulate midnight evaluation"
              style={({ pressed }) => [
                {
                  marginTop: 12,
                  backgroundColor: colors.accentPrimary,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  opacity: pressed ? 0.82 : 1,
                  alignSelf: "flex-start",
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 12 }}>
                Simulate Midnight Evaluation
              </Text>
            </Pressable>
            <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>Today: {localDateKey()} | Simulated day: {getYesterdayDateKey()}</Text>
          </View>
        ) : null}
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
