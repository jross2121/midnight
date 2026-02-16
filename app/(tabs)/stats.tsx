import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CategoryDetails } from "./_components/CategoryDetails";
import { Footer } from "./_components/Footer";
import { StatWheel } from "./_components/StatWheel";
import { StatsOverview } from "./_components/StatsOverview";
import { createStyles } from "./_styles";
import { defaultCategories, defaultDrHistory } from "./_utils/defaultData";
import { DR_RANK_THRESHOLDS, getNextRank, getRankEmoji, getRankFromDR } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Category, DrHistoryEntry, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [disciplineRating, setDisciplineRating] = useState<number>(0);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [hydrated, setHydrated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const isDrHistoryEntry = (value: unknown): value is DrHistoryEntry => {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<DrHistoryEntry>;
    return (
      typeof candidate.date === "string" &&
      typeof candidate.dr === "number" &&
      typeof candidate.delta === "number" &&
      typeof candidate.pct === "number"
    );
  };

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
      const loadedDR = typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : 0;
      const loadedHistory = Array.isArray(parsed.drHistory)
        ? parsed.drHistory.filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry)).slice(-30)
        : defaultDrHistory;
      setCategories(loadedCategories);
      setDisciplineRating(loadedDR);
      setDrHistory(loadedHistory);
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

  if (!hydrated) {
    return null;
  }

  const selectedCategoryData = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)
    : null;
  const rankName = getRankFromDR(disciplineRating);
  const nextRank = getNextRank(disciplineRating);
  const latestHistory = drHistory.slice(-7).reverse();
  const drRules: Array<{ label: string; delta: string; tone: "pos" | "neu" | "neg" }> = [
    { label: "100% completion", delta: "+10", tone: "pos" },
    { label: "85-99%", delta: "+7", tone: "pos" },
    { label: "60-84%", delta: "+4", tone: "pos" },
    { label: "30-59%", delta: "0", tone: "neu" },
    { label: "1-29%", delta: "-4", tone: "neg" },
    { label: "0% or no quests", delta: "-8", tone: "neg" },
  ];
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <IconSymbol name="chart.bar.fill" size={36} color={colors.accentPrimary} />
          <Text style={styles.title}>📊 Stats</Text>
        </View>

        <View
          style={[
            styles.pill,
            styles.drPrimaryPill,
            { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 24 },
          ]}
        >
          <Text style={[styles.pillLabel, styles.drLabelText, { color: colors.textSecondary }]}>Discipline Rating</Text>
          <Text style={[styles.pillValue, styles.drPrimaryValue, { color: colors.accentPrimary }]}>
            {disciplineRating}
          </Text>
          <Text style={[styles.drRankText, { color: colors.textSecondary }]}>
            {getRankEmoji(rankName)} {rankName}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 24, paddingTop: 16 }]}>
          <Text style={[styles.cardTitle, { marginBottom: 10 }]}>DR Rating System</Text>
          <View style={styles.drSystemTopRow}>
            <Text style={styles.drSystemTopText}>
              Current Rank: <Text style={{ color: colors.accentPrimary, fontWeight: "900" }}>{rankName}</Text>
            </Text>
            <Text style={[styles.drSystemTopText, { color: colors.textSecondary }]}>
              {disciplineRating} points
            </Text>
          </View>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginBottom: 8, marginTop: 0 }]}>
            {nextRank
              ? `Next Rank: ${nextRank.name} in ${nextRank.remainingDr}`
              : "Top Rank reached: Grand Discipline"}
          </Text>

          <Text style={styles.drSystemSubhead}>Rank Thresholds</Text>
          {DR_RANK_THRESHOLDS.map((rank, idx) => {
            const next = DR_RANK_THRESHOLDS[idx + 1];
            const min = rank.minDr;
            const maxLabel = next ? `${next.minDr - 1}` : "INF";
            const isCurrent = rank.name === rankName;
            return (
              <View
                key={rank.name}
                style={[
                  styles.drSystemRow,
                  isCurrent && styles.drSystemRowActive,
                ]}
              >
                <Text
                  style={[
                    styles.drSystemRankName,
                    isCurrent && { color: colors.accentPrimary, fontWeight: "900" },
                  ]}
                >
                  {rank.name}
                </Text>
                <Text style={styles.drSystemRankRange}>
                  {min}-{maxLabel}
                </Text>
              </View>
            );
          })}

          <Text style={styles.drSystemSubhead}>Daily Change Rules</Text>
          {drRules.map((rule) => (
            <View key={rule.label} style={styles.drSystemRow}>
              <Text style={styles.drSystemRuleLabel}>{rule.label}</Text>
              <Text
                style={[
                  styles.drSystemRuleDelta,
                  {
                    color:
                      rule.tone === "pos"
                        ? colors.accentSecondary
                        : rule.tone === "neg"
                        ? colors.accentPrimary
                        : colors.textSecondary,
                  },
                ]}
              >
                {rule.delta}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 24 }]}>
          <Text style={[styles.cardTitle, { marginBottom: 10 }]}>DR History</Text>
          {latestHistory.length ? (
            latestHistory.map((entry) => (
              <Text key={entry.date} style={[styles.questMeta, { marginTop: 4 }]}>
                {entry.date} • {entry.pct}% • {entry.delta >= 0 ? `+${entry.delta}` : entry.delta} • DR {entry.dr}
              </Text>
            ))
          ) : (
            <Text style={[styles.questMeta, { color: colors.textSecondary }]}>
              No DR history yet. Complete quests and roll to the next day.
            </Text>
          )}
        </View>

        {/* Stat Wheel - Interactive radar chart */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Life Wheel</Text>
          <StatWheel
            categories={categories}
            onSelectCategory={setSelectedCategory}
            selectedCategory={selectedCategory}
          />
          {selectedCategoryData ? (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[styles.questMeta, { color: colors.textSecondary, marginBottom: 8 }]}> 
                Selected: <Text style={{ color: colors.accentPrimary, fontWeight: "900" }}>{selectedCategoryData.name}</Text>
              </Text>
              <Text style={[styles.questMeta, { fontSize: 12 }]}>
                Level {selectedCategoryData.level} • {selectedCategoryData.xp}/{selectedCategoryData.xpToNext} XP
              </Text>
            </View>
          ) : (
            <Text style={[styles.questMeta, { marginTop: 12, color: colors.textSecondary, textAlign: "center" }]}>
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
