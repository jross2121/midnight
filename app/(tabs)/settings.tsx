import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Footer } from "./_components/Footer";
import { createStyles } from "./_styles";
import { localDateKey } from "./_utils/dateHelpers";
import { defaultLastCompletionPct, defaultLastDrDelta, defaultLastDrUpdateDate } from "./_utils/defaultData";
import { MIDNIGHT_EVALUATION_STORAGE_KEY } from "./_utils/midnightEvaluation";
import { useTheme } from "./_utils/themeContext";
import { STORAGE_KEY, type StoredState } from "./_utils/types";

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
          <Text style={styles.title}>⚙️ Settings</Text>
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
                {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
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
