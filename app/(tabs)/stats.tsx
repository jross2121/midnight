import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CategoryDetails } from "./components/CategoryDetails";
import { Footer } from "./components/Footer";
import { StatWheel } from "./components/StatWheel";
import { StatsOverview } from "./components/StatsOverview";
import { styles } from "./styles";
import { defaultCategories } from "./utils/defaultData";
import { useTheme } from "./utils/themeContext";
import type { Category, StoredState } from "./utils/types";
import { STORAGE_KEY } from "./utils/types";

export default function StatsScreen() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [hydrated, setHydrated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const loadedCategories =
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : defaultCategories;
      setCategories(loadedCategories);
      setHydrated(true);
    } catch (e) {
      console.log("Failed to load storage:", e);
      setHydrated(true);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data whenever this tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Poll for updates every 1 second while this screen is visible
  useEffect(() => {
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (!hydrated) {
    return null;
  }

  const selectedCategoryData = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)
    : null;
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <IconSymbol name="chart.bar.fill" size={36} color={colors.accent} />
          <Text style={styles.title}>📊 Stats</Text>
        </View>

        {/* Stat Wheel - Interactive radar chart */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Life Wheel</Text>
          <StatWheel
            categories={categories}
            onSelectCategory={setSelectedCategory}
            selectedCategory={selectedCategory}
          />
          {selectedCategoryData ? (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#1f2a3c" }}>
              <Text style={[styles.questMeta, { color: "#8fa3b0", marginBottom: 8 }]}>
                Selected: <Text style={{ color: "#00d9ff", fontWeight: "900" }}>{selectedCategoryData.name}</Text>
              </Text>
              <Text style={[styles.questMeta, { fontSize: 12 }]}>
                Level {selectedCategoryData.level} • {selectedCategoryData.xp}/{selectedCategoryData.xpToNext} XP
              </Text>
            </View>
          ) : (
            <Text style={[styles.questMeta, { marginTop: 12, color: "#5a6a7a", textAlign: "center" }]}>
              Tap a category to view details
            </Text>
          )}
        </View>

        {/* Overview stats */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.section}>Overview</Text>
          <StatsOverview categories={categories} />
        </View>

        {/* Selected category detailed view */}
        {selectedCategoryData && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.section}>Detailed Stats</Text>
            <CategoryDetails category={selectedCategoryData} />
          </View>
        )}

        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
