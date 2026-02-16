import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Achievements } from "./_components/Achievements";
import { Footer } from "./_components/Footer";
import { createStyles } from "./_styles";
import { defaultAchievements } from "./_utils/defaultData";
import { useTheme } from "./_utils/themeContext";
import type { Achievement, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setHydrated(true);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        const loadedAchievements = Array.isArray(parsed.achievements)
          ? parsed.achievements
          : defaultAchievements;
        setAchievements(loadedAchievements);
      } catch (e) {
        console.log("Failed to load storage:", e);
      } finally {
        setHydrated(true);
      }
    };
    loadData();
  }, []);

  if (!hydrated) {
    return null;
  }

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
  const totalCount = achievements.length;

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <IconSymbol name="star.fill" size={36} color={colors.accentPrimary} />
          <Text style={[styles.title, { color: colors.accentPrimary }]}>⭐ Achievements</Text>
        </View>

        <View style={styles.topRow}>
          <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Unlocked</Text>
            <Text style={[styles.pillValue, { color: colors.accentPrimary }]}>
              {unlockedCount}/{totalCount}
            </Text>
          </View>

          <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>Progress</Text>
            <Text style={[styles.pillValue, { color: colors.accentPrimary }]}>
              {Math.round((unlockedCount / totalCount) * 100)}%
            </Text>
          </View>
        </View>

        <Achievements achievements={achievements} />

        <Text style={styles.hint}>
          🏆 Complete quests, build discipline, reach milestones, and level up your categories to unlock all achievements!
        </Text>
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
